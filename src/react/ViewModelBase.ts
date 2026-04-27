import { useSnapshot } from 'valtio';
import {
  ViewModelBase as CoreViewModelBase,
  type ViewModelState,
} from '../core/ViewModelBase';

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
   * The return type is `T` (not `DeepReadonly<T>`) for ergonomic
   * composition with child components. The returned object is still
   * runtime-readonly: any write attempt is rejected by valtio.
   * Mutate via `vm.data.x = ...` or class methods instead.
   */
  useSnapshot(): T {
    return useSnapshot(this.data) as T;
  }
}
