import { createStore, type StoreApi } from 'zustand/vanilla';

export type ViewModelState = Record<string, unknown>;

/**
 * Framework-agnostic ViewModel base class.
 *
 * Subclasses implement `$data()` to declare initial state, then mutate via
 * `$set()`. Views (or any consumer) subscribe via `$subscribe()`.
 *
 * Lifecycle hooks (override as needed):
 *   - `onInit`     fires once when the instance is constructed
 *   - `onMount`    fires when the first view attaches (ref count goes 0 -> 1)
 *   - `onUnmount`  fires when the last view detaches (ref count goes 1 -> 0)
 *   - `onDispose`  fires when the instance is permanently torn down
 */
export abstract class ViewModelBase<T extends ViewModelState> {
  protected readonly store: StoreApi<T>;

  private mountCount = 0;
  private disposed = false;

  constructor(initial?: Partial<T>) {
    this.store = createStore<T>(() => ({
      ...this.$data(),
      ...(initial as Partial<T> | undefined),
    }));
    this.onInit();
  }

  /** Declare the initial state. Called once by the constructor. */
  protected abstract $data(): T;

  /** Read the current state snapshot. Not reactive. */
  protected get data(): T {
    return this.store.getState();
  }

  /** Update state. Accepts a partial object or an updater function. */
  protected readonly $set = (
    updater: Partial<T> | ((s: T) => Partial<T>),
  ): void => {
    this.store.setState(updater as Parameters<StoreApi<T>['setState']>[0]);
  };

  /** Subscribe to state changes. Returns an unsubscribe function. */
  $subscribe(listener: (state: T, prev: T) => void): () => void {
    return this.store.subscribe(listener);
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
    this.mountCount = Math.max(0, this.mountCount - 1);
    if (this.mountCount === 0) this.onUnmount();
  }

  /** Tear down the instance. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onDispose();
  }

  /** @internal Expose the underlying store for view bindings. */
  __getStore(): StoreApi<T> {
    return this.store;
  }
}
