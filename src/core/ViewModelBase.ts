import { proxy, subscribe } from 'valtio/vanilla';
import { subscribeKey } from 'valtio/utils';
import { isDev } from '../internal/dev';

export type ViewModelState = object;

/**
 * Extract the state type from a ViewModelBase subclass.
 * @internal Used by react bindings; not part of the public API.
 */
export type StateOf<VM> = VM extends ViewModelBase<infer T> ? T : never;

// Per-instance lifecycle state lives in a module-level WeakMap so the VM
// instance has zero internal own properties — `vm.` autocomplete stays clean.
interface VMState {
  mountCount: number;
  disposed: boolean;
  // Single effect scope, Vue-style: $subscribe / $watch / $onCleanup all
  // register here. Drained at $dispose().
  cleanups: Array<() => void>;
}

const states = new WeakMap<ViewModelBase<any>, VMState>();

const safeRun = (fn: () => void): void => {
  try {
    fn();
  } catch (err) {
    console.error('[bizify] cleanup error:', err);
  }
};

// Framework-only structural casts. One helper per protected surface — keeps
// each cast self-contained and renames type-check against the shape.
const invokeOnMount = (vm: ViewModelBase<any>): void => {
  (vm as unknown as { onMount(): void }).onMount();
};
const invokeOnUnmount = (vm: ViewModelBase<any>): void => {
  (vm as unknown as { onUnmount(): void }).onUnmount();
};
const invokeDispose = (vm: ViewModelBase<any>): void => {
  (vm as unknown as { $dispose(): void }).$dispose();
};
const callData = <T extends ViewModelState>(vm: ViewModelBase<T>): T =>
  (vm as unknown as { $data(): T }).$data();

/**
 * Tear down a ViewModel manually (non-React usage / tests). Idempotent.
 * Fires `onUnmount` (if mounted) → `onDispose`, then drains the effect
 * scope. React-managed VMs auto-call this on component unmount.
 */
export function dispose(vm: ViewModelBase<any>): void {
  invokeDispose(vm);
}

/**
 * Whether `dispose(vm)` has been called on this VM.
 *
 * Fail-safe: returns `true` for unrecognized inputs (e.g., a value that
 * isn't actually a constructed VM, or one whose WeakMap entry has been
 * GC'd). Callers can treat "unknown" as "treat as disposed" without
 * extra checks. The class-internal `this.$disposed` getter is stricter
 * (asserts entry presence) since it always runs against a constructed
 * instance.
 */
export function isDisposed(vm: ViewModelBase<any>): boolean {
  return states.get(vm)?.disposed ?? true;
}

// Build the proxy seed from $data() + initial. defineProperties preserves
// accessor descriptors so computed getters survive proxy wrapping; spread
// or assign would freeze them to one-shot snapshots.
const buildSeed = <T extends ViewModelState>(
  vm: ViewModelBase<T>,
  initial?: Partial<T>,
): Record<string, unknown> => {
  const seed: Record<string, unknown> = {};
  Object.defineProperties(
    seed,
    Object.getOwnPropertyDescriptors(callData(vm)),
  );
  if (!initial) return seed;
  for (const key of Object.keys(initial)) {
    // Skip accessor keys (computed getters from $data) — Object.assign
    // throws on getter-only keys; warn-and-skip is friendlier.
    const desc = Object.getOwnPropertyDescriptor(seed, key);
    if (desc && (desc.get || desc.set)) {
      if (isDev) {
        console.warn(
          `[bizify] initial.${key} ignored: it's a computed property in $data().`,
        );
      }
      continue;
    }
    seed[key] = (initial as Record<string, unknown>)[key];
  }
  return seed;
};

// Module-level so it stays off the prototype (autoBind would otherwise
// bind it onto every instance and pollute `vm.` autocomplete).
const trackCleanup = (
  vm: ViewModelBase<any>,
  fn: () => void,
): (() => void) => {
  const s = states.get(vm);
  if (!s || s.disposed) {
    safeRun(fn);
    return () => {};
  }
  s.cleanups.push(fn);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const idx = s.cleanups.indexOf(fn);
    if (idx >= 0) s.cleanups.splice(idx, 1);
    safeRun(fn);
  };
};

const drainCleanups = (list: Array<() => void>): void => {
  while (list.length) safeRun(list.pop()!);
};

/** @internal Framework-only. */
export function _vmMount(vm: ViewModelBase<any>): void {
  const s = states.get(vm)!;
  if (s.disposed) return;
  s.mountCount++;
  if (s.mountCount === 1) invokeOnMount(vm);
}

/** @internal Framework-only. */
export function _vmUnmount(vm: ViewModelBase<any>): void {
  const s = states.get(vm)!;
  if (s.disposed || s.mountCount === 0) return;
  s.mountCount--;
  if (s.mountCount === 0) invokeOnUnmount(vm);
}

/**
 * ViewModel base class, backed by valtio.
 *
 * - `data` is a protected proxy. Mutate it directly inside VM methods.
 * - Computed properties: declare them as getters in the `$data()` return.
 * - Lifecycle: `onInit` (construction) → `onMount` → `onUnmount` →
 *   `onDispose`. React-managed VMs auto-`$dispose()` on component unmount;
 *   externally-constructed VMs require an explicit `$dispose()` call.
 * - Subscriptions registered via `$subscribe` / `$watch` / `$onCleanup`
 *   share a single Vue-style effect scope and are drained at `$dispose()`.
 * - Under React 18 StrictMode, `onMount` / `onUnmount` are coalesced to
 *   fire exactly once per real cycle (microtask reconciliation in the
 *   React layer).
 */
export abstract class ViewModelBase<T extends ViewModelState> {
  protected readonly data: T;

  constructor(initial?: Partial<T>) {
    this.data = proxy(buildSeed(this, initial)) as T;
    states.set(this, { mountCount: 0, disposed: false, cleanups: [] });
    this.autoBindMethods();
    this.onInit();
  }

  /**
   * Return the initial state shape. Computed properties are declared as
   * getters in the returned object — they're preserved as accessors on
   * the proxy.
   *
   * **Must be pure**: do not call `$subscribe` / `$watch` / `$onCleanup`
   * here, do not touch `this.data` (it's not yet a proxy at this point).
   * Side effects belong in `onInit` / `onMount`.
   */
  protected abstract $data(): T;

  protected $subscribe(listener: () => void): () => void {
    if (this.$disposed) return () => {};
    return trackCleanup(this, subscribe(this.data, listener));
  }

  /**
   * Watch a source for changes. Source can be either a top-level state
   * key or a getter expression that reads from `this.data` (supports
   * nested paths and computed expressions). Listener receives
   * `(newValue, oldValue)`; when `immediate: true`, the first call's
   * `oldValue` is `undefined`.
   *
   * Equality is `Object.is` — getters that return new arrays/objects on
   * every call will fire on every state change.
   */
  protected $watch<K extends keyof T>(
    source: K,
    listener: (value: T[K], oldValue: T[K] | undefined) => void,
    options?: { immediate?: boolean },
  ): () => void;
  protected $watch<V>(
    source: () => V,
    listener: (value: V, oldValue: V | undefined) => void,
    options?: { immediate?: boolean },
  ): () => void;
  protected $watch(
    source: keyof T | (() => unknown),
    listener: (value: unknown, oldValue: unknown) => void,
    options?: { immediate?: boolean },
  ): () => void {
    if (this.$disposed) return () => {};

    const read = (): unknown => {
      if (typeof source === 'function') return source();
      return Reflect.get(this.data, source);
    };

    let prev = read();
    const fire = (): void => {
      const next = read();
      if (Object.is(next, prev)) return;
      const old = prev;
      prev = next;
      listener(next, old);
    };

    const unsub =
      typeof source === 'function'
        ? subscribe(this.data, fire)
        : subscribeKey(this.data, source, fire);

    if (options?.immediate) listener(prev, undefined);

    return trackCleanup(this, unsub);
  }

  /**
   * Register an arbitrary cleanup tied to this VM's lifetime (Vue-style
   * effect scope). Runs at `$dispose()`. Returns an idempotent remover.
   */
  protected $onCleanup(fn: () => void): () => void {
    return trackCleanup(this, fn);
  }

  protected onInit(): void {}
  protected onMount(): void {}
  protected onUnmount(): void {}
  protected onDispose(): void {}

  /**
   * True after disposal. Use inside async actions to short-circuit
   * post-unmount writes:
   * ```ts
   * async fetchTodos() {
   *   const data = await api.get();
   *   if (this.$disposed) return;
   *   this.data.todos = data;
   * }
   * ```
   *
   * Outside the class, use `isDisposed(vm)` instead — `$disposed` is
   * protected to keep view-layer `vm.` autocomplete clean.
   */
  protected get $disposed(): boolean {
    return states.get(this)!.disposed;
  }

  /**
   * Tear down the instance. Idempotent. If still mounted, fires
   * `onUnmount` first; then `onDispose`; then drains all subscriptions
   * registered via `$subscribe` / `$watch` / `$onCleanup`.
   *
   * Outside the class, use `dispose(vm)` instead — `$dispose` is
   * protected to keep view-layer `vm.` autocomplete clean.
   *
   * **Do not override.** Override `onDispose` for cleanup logic;
   * overriding `$dispose` itself bypasses the framework's lifecycle
   * sequencing (onUnmount → onDispose → drain scope) and breaks
   * subscription auto-cleanup.
   */
  protected $dispose(): void {
    const s = states.get(this);
    if (!s || s.disposed) return;
    if (s.mountCount > 0) {
      s.mountCount = 0;
      this.onUnmount();
    }
    s.disposed = true;
    this.onDispose();
    drainCleanups(s.cleanups);
  }

  /**
   * Bind user-defined prototype methods to `this` as non-enumerable own
   * properties, so methods survive destructuring / event-handler passing.
   * Framework-prefixed (`$*`) methods are skipped — they're called as
   * `vm.method()`, never destructured.
   */
  private autoBindMethods(): void {
    let proto: object | null = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        if (name.startsWith('$')) continue;
        if (Object.prototype.hasOwnProperty.call(this, name)) continue;
        const desc = Object.getOwnPropertyDescriptor(proto, name)!;
        if (typeof desc.value !== 'function') continue;
        Object.defineProperty(this, name, {
          value: desc.value.bind(this),
          writable: true,
          configurable: true,
        });
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
}
