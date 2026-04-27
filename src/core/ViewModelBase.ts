import { createStore, type StoreApi } from 'zustand/vanilla';
import { isDev } from '../internal/dev';

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
 *   - `onDispose`  fires only when `dispose()` is called explicitly
 *
 * Note: in React 18 StrictMode, components mount → unmount → mount in dev,
 * which means `onMount` / `onUnmount` may fire twice in a row. Keep them
 * idempotent (same as React's `useEffect` contract).
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
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onDispose();
  }
}
