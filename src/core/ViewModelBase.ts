import { proxy, subscribe } from 'valtio/vanilla';
import { subscribeKey } from 'valtio/utils';
import { isDev } from '../internal/dev';

export type ViewModelState = Record<string, unknown>;

/**
 * @internal Symbol-keyed lifecycle hooks called by view bindings.
 * Symbols hide these from the public `vm.` autocomplete surface — they're
 * accessible only to callers that explicitly import the symbols (the
 * framework's own React layer).
 */
export const VM_MOUNT: unique symbol = Symbol('bizify.vm.mount');
export const VM_UNMOUNT: unique symbol = Symbol('bizify.vm.unmount');

/**
 * Framework-agnostic ViewModel base class, backed by valtio.
 *
 * - `this.data` is a valtio proxy. Read it directly, mutate it directly:
 *   `this.data.count++` / `this.data.items.push(x)` / `this.data.user.name = 'X'`.
 *   It is **protected** — only callable inside VM methods, not from views.
 *   Views read state via `useSnapshot()` (in the React layer).
 * - Computed properties are declared as **getters in `$data()` return**, e.g.
 *   `get total() { return this.items.reduce(...); }`. Both `this.data.total`
 *   inside the VM and `useSnapshot(vm.data).total` in views auto-track deps.
 * - `$subscribe(cb)` / `$watch(key, cb)` are **protected** — meant for VM
 *   internal use (typically inside `onMount`). Expose specific subscriptions
 *   as public methods if external code needs them.
 *
 * Lifecycle hooks (override as needed):
 *   - `onInit`     fires once when the instance is constructed
 *   - `onMount`    fires when the first view attaches (ref count goes 0 -> 1)
 *   - `onUnmount`  fires when the last view detaches (ref count goes 1 -> 0)
 *   - `onDispose`  fires only when `$dispose()` is called explicitly
 *
 * In React 18 StrictMode, `onMount` / `onUnmount` are coalesced to fire
 * exactly once per real mount/unmount via the React layer's lifecycle binding.
 */
export abstract class ViewModelBase<T extends ViewModelState> {
  protected readonly data: T;

  private mountCount = 0;
  private disposed = false;

  constructor(initial?: Partial<T>) {
    // Preserve getter descriptors from $data() — spread/assign would copy
    // value snapshots and kill computed properties.
    const baseShape = this.$data();
    const seed: Record<string, unknown> = {};
    Object.defineProperties(seed, Object.getOwnPropertyDescriptors(baseShape));
    if (initial) {
      // Initial overrides apply as plain values; users shouldn't override
      // computed keys.
      Object.assign(seed, initial);
    }
    this.data = proxy(seed) as T;
    this.autoBindPrototypeMethods();
    this.onInit();
  }

  /** Declare the initial state. Called once by the constructor. */
  protected abstract $data(): T;

  /**
   * Subscribe to any state change. Callback receives no args; use
   * `import { snapshot } from 'valtio'` to capture the current snapshot.
   * Protected — typically called from `onMount`.
   */
  protected $subscribe(listener: () => void): () => void {
    return subscribe(this.data, listener);
  }

  /**
   * Subscribe to a single state key. Callback receives the new value.
   * Protected — typically called from `onMount`.
   */
  protected $watch<K extends keyof T>(
    key: K,
    listener: (value: T[K]) => void,
  ): () => void {
    return subscribeKey(
      this.data,
      key as string,
      listener as (v: unknown) => void,
    );
  }

  // ─── lifecycle hooks (subclasses override) ───────────────────────────

  protected onInit(): void {}
  protected onMount(): void {}
  protected onUnmount(): void {}
  protected onDispose(): void {}

  // ─── ref counting (Symbol-keyed: callable by view bindings only) ──

  /** @internal */
  [VM_MOUNT](): void {
    if (this.disposed) return;
    if (this.mountCount === 0) this.onMount();
    this.mountCount++;
  }

  /** @internal */
  [VM_UNMOUNT](): void {
    if (this.disposed) return;
    if (this.mountCount === 0) {
      if (isDev) {
        console.warn(
          '[bizify] [VM_UNMOUNT] called without a matching mount. ' +
            'This usually indicates a binding bug.',
        );
      }
      return;
    }
    this.mountCount--;
    if (this.mountCount === 0) this.onUnmount();
  }

  /**
   * Tear down the instance. Idempotent. Triggers `onDispose`.
   *
   * Not called automatically by `useViewModel` or the Provider from
   * `createViewModelContext` — those rely on `onUnmount` for cleanup so
   * they remain safe under React StrictMode. Call this explicitly when
   * you need a one-shot teardown (tests, container/registry patterns).
   */
  $dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onDispose();
  }

  /**
   * Walk the prototype chain and bind every method to `this` as a
   * non-enumerable own property. Lets users define methods either as
   * arrow class fields (`plus = () => ...`) or as plain prototype methods
   * (`plus() { ... }`) — both can be passed as handlers without losing
   * `this`.
   *
   * Symbol-keyed methods (`[VM_MOUNT]` / `[VM_UNMOUNT]`) are skipped
   * (Object.getOwnPropertyNames returns string keys only). They're called
   * via `vm[VM_MOUNT]()` syntax with `this` bound to vm naturally.
   */
  private autoBindPrototypeMethods(): void {
    let proto: object | null = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        if (Object.prototype.hasOwnProperty.call(this, name)) continue;
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if (!desc || desc.get || desc.set) continue;
        if (typeof desc.value !== 'function') continue;
        Object.defineProperty(this, name, {
          value: (desc.value as (...args: unknown[]) => unknown).bind(this),
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
}
