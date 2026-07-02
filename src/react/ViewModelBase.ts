import { useSnapshot } from 'valtio';
import {
  ViewModelBase as CoreViewModelBase,
  type ViewModelState,
} from '../core/ViewModelBase';

/** Options for {@link ViewModelBase.useSnapshot}. */
export interface UseSnapshotOptions {
  /**
   * Notify React synchronously on every mutation (default `true`).
   *
   * valtio itself defaults to async (microtask-batched) notification, which
   * breaks controlled text inputs bound to the snapshot — fast typing drops
   * characters / jumps the caret, and IME composition misbehaves — because
   * the re-render lands one microtask after the input event. Business apps
   * are form-heavy, so bizify flips the default to `sync: true`; with React
   * 18+ automatic batching, same-tick mutations still coalesce into one
   * render, so the cost is negligible.
   *
   * Pass `sync: false` to restore valtio's microtask batching for
   * high-frequency mutation scenarios (animations, streaming updates)
   * where coalescing across await points matters more than immediacy.
   */
  sync?: boolean;
}

/**
 * React ViewModel base class.
 *
 * Adds `useSnapshot()` — returns the valtio snapshot of `this.data` with
 * auto-tracked reads. Component re-renders only when the fields you
 * actually read change.
 *
 * Computed properties live in `$data()` as getters; they appear on `vm.data`
 * and on the snapshot, both auto-tracked.
 */
export abstract class ViewModelBase<
  T extends ViewModelState,
> extends CoreViewModelBase<T> {
  /**
   * React hook. Subscribe to the ViewModel's state and return a tracking
   * snapshot — reading any field subscribes the component to that field.
   * Only callable inside React components.
   *
   * Notifies synchronously by default (`sync: true`) so controlled inputs
   * bound to the snapshot behave correctly; see {@link UseSnapshotOptions.sync}.
   *
   * The return type is `T` (not `DeepReadonly<T>`) for ergonomic
   * composition with child components. The returned object is still
   * runtime-readonly: any write attempt is rejected by valtio.
   * Mutate via `vm.data.x = ...` or class methods instead.
   */
  useSnapshot(options?: UseSnapshotOptions): T {
    return useSnapshot(this.data, { sync: options?.sync ?? true }) as T;
  }
}
