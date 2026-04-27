import { proxy, subscribe } from 'valtio/vanilla';
import { subscribeKey } from 'valtio/utils';
import { isDev } from '../internal/dev';

export type ViewModelState = Record<string, unknown>;

/**
 * Framework-agnostic ViewModel base class, backed by valtio.
 *
 * - `this.data` is a valtio proxy. Read it directly, mutate it directly:
 *   `this.data.count++` / `this.data.items.push(x)` / `this.data.user.name = 'X'`.
 * - Computed properties are declared as **getters in `$data()` return**, e.g.
 *   `get total() { return this.items.reduce(...); }`. Both `vm.data.total` and
 *   `useSnapshot(vm.data).total` work and auto-track dependencies.
 * - `$subscribe(cb)` for any-state-change notifications.
 * - `$watch(key, cb)` for single-key change notifications (with prev/next).
 *
 * Lifecycle hooks (override as needed):
 *   - `onInit`     fires once when the instance is constructed
 *   - `onMount`    fires when the first view attaches (ref count goes 0 -> 1)
 *   - `onUnmount`  fires when the last view detaches (ref count goes 1 -> 0)
 *   - `onDispose`  fires only when `dispose()` is called explicitly
 *
 * In React 18 StrictMode, `onMount` / `onUnmount` are coalesced to fire
 * exactly once per real mount/unmount via the React layer's lifecycle binding.
 */
export abstract class ViewModelBase<T extends ViewModelState> {
  readonly data: T;

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
   * `import { snapshot } from 'valtio'` to capture the current snapshot
   * if you need it.
   */
  $subscribe(listener: () => void): () => void {
    return subscribe(this.data, listener);
  }

  /**
   * Subscribe to a single state key. Callback receives the new value.
   * For deep paths, prefer composing computed getters in `$data` and
   * watching the computed key.
   */
  $watch<K extends keyof T>(
    key: K,
    listener: (value: T[K]) => void,
  ): () => void {
    return subscribeKey(this.data, key as string, listener as (v: unknown) => void);
  }

  // ─── lifecycle hooks (subclasses override) ───────────────────────────

  protected onInit(): void {}
  protected onMount(): void {}
  protected onUnmount(): void {}
  protected onDispose(): void {}

  // ─── ref counting (called by view bindings, not user code) ───────────

  /** @internal Called by view bindings on mount. */
  __mount(): void {
    if (this.disposed) return;
    if (this.mountCount === 0) this.onMount();
    this.mountCount++;
  }

  /** @internal Called by view bindings on unmount. */
  __unmount(): void {
    if (this.disposed) return;
    if (this.mountCount === 0) {
      if (isDev) {
        console.warn(
          '[bizify] __unmount() called without a matching __mount(). ' +
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
   * Skipped:
   *   - `constructor`
   *   - getters/setters (e.g. `data` accessor)
   *   - non-function descriptors
   *   - properties already defined on the instance (arrow fields shadow)
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
