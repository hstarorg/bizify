import { proxy, subscribe } from 'valtio/vanilla';
import { subscribeKey } from 'valtio/utils';
import { isDev } from '../internal/dev';

export type ViewModelState = Record<string, unknown>;

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

// onMount/onUnmount are protected; framework boundary needs to call them
// via structural cast so renames still type-check.
type LifecycleHooks = { onMount(): void; onUnmount(): void };

const drainCleanups = (list: Array<() => void>): void => {
  while (list.length) {
    const fn = list.pop()!;
    try {
      fn();
    } catch (err) {
      console.error('[bizify] cleanup error:', err);
    }
  }
};

// Module-level so it stays off the prototype (autoBind would bind it onto
// every instance and pollute `vm.` autocomplete).
const trackCleanup = (
  vm: ViewModelBase<any>,
  fn: () => void,
): (() => void) => {
  const s = states.get(vm);
  if (!s || s.disposed) {
    try {
      fn();
    } catch (err) {
      console.error('[bizify] cleanup error:', err);
    }
    return () => {};
  }
  s.cleanups.push(fn);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const idx = s.cleanups.indexOf(fn);
    if (idx >= 0) s.cleanups.splice(idx, 1);
    try {
      fn();
    } catch (err) {
      console.error('[bizify] cleanup error:', err);
    }
  };
};

/** @internal Framework-only. */
export function _vmMount(vm: ViewModelBase<any>): void {
  const s = states.get(vm)!;
  if (s.disposed) return;
  s.mountCount++;
  if (s.mountCount === 1) (vm as unknown as LifecycleHooks).onMount();
}

/** @internal Framework-only. */
export function _vmUnmount(vm: ViewModelBase<any>): void {
  const s = states.get(vm)!;
  if (s.disposed || s.mountCount === 0) return;
  s.mountCount--;
  if (s.mountCount === 0) (vm as unknown as LifecycleHooks).onUnmount();
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
    // defineProperties preserves accessor descriptors from $data() so
    // computed getters survive the proxy wrapping (spread/assign would
    // freeze them to one-shot snapshots).
    const seed: Record<string, unknown> = {};
    Object.defineProperties(
      seed,
      Object.getOwnPropertyDescriptors(this.$data()),
    );
    if (initial) {
      for (const key of Object.keys(initial)) {
        // Skip accessor keys (computed getters from $data) — Object.assign
        // would silently overwrite them with a data descriptor.
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
    }
    this.data = proxy(seed) as T;

    states.set(this, { mountCount: 0, disposed: false, cleanups: [] });
    this.autoBindMethods();
    this.onInit();
  }

  protected abstract $data(): T;

  protected $subscribe(listener: () => void): () => void {
    return trackCleanup(this, subscribe(this.data, listener));
  }

  protected $watch<K extends keyof T>(
    key: K,
    listener: (value: T[K]) => void,
  ): () => void {
    return trackCleanup(
      this,
      subscribeKey(
        this.data,
        key as string,
        listener as (v: unknown) => void,
      ),
    );
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

  /** True after `$dispose()` has been called. */
  get $disposed(): boolean {
    return states.get(this)?.disposed ?? true;
  }

  /**
   * Tear down the instance. Idempotent. If still mounted, fires
   * `onUnmount` first; then `onDispose`; then drains all subscriptions
   * registered via `$subscribe` / `$watch` / `$onCleanup`.
   */
  $dispose(): void {
    const s = states.get(this);
    if (!s || s.disposed) return;
    if (s.mountCount > 0) {
      s.mountCount = 0;
      (this as unknown as LifecycleHooks).onUnmount();
    }
    s.disposed = true;
    this.onDispose();
    drainCleanups(s.cleanups);
  }

  /**
   * Bind every prototype method to `this` as a non-enumerable own
   * property, so methods survive destructuring / event-handler passing.
   */
  private autoBindMethods(): void {
    let proto: object | null = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
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
