import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  ViewModelBase as CoreViewModelBase,
  type ViewModelState,
} from '../core/ViewModelBase';
import { isDev } from '../internal/dev';

let coarseUseWarned = false;

/**
 * React ViewModel base class.
 *
 * Extends the framework-agnostic core with React hooks:
 *   - `use(selector, equality?)`     fine-grained subscription
 *   - `useDerived(fn, equality?)`    subscribe to a derived value
 *
 * The hook methods are React hooks — only callable inside components.
 */
export abstract class ViewModelBase<
  T extends ViewModelState,
> extends CoreViewModelBase<T> {
  /**
   * Subscribe to a slice of state. Re-renders only when the slice changes.
   * Pass `'shallow'` as second arg to compare returned objects shallowly.
   */
  use<U>(selector: (state: T) => U, equality?: 'shallow'): U;
  /** Subscribe to the entire state. Re-renders on any change (discouraged). */
  use(): T;
  use<U>(selector?: (state: T) => U, equality?: 'shallow'): U | T {
    if (!selector) {
      if (isDev && !coarseUseWarned) {
        coarseUseWarned = true;
        console.warn(
          '[bizify] vm.use() without a selector subscribes to the entire ' +
            'state and re-renders on every change. Prefer ' +
            'vm.use(s => s.field) for fine-grained updates.',
        );
      }
      return useStore(this.store);
    }
    if (equality === 'shallow') {
      return useStore(this.store, useShallow(selector));
    }
    return useStore(this.store, selector);
  }

  /**
   * Subscribe to a value derived from this ViewModel (e.g. a class getter).
   * Re-renders when the returned value changes (Object.is by default).
   *
   * Pass `'shallow'` for derived values that return new arrays/objects
   * each call (e.g. computed lists), to avoid spurious re-renders.
   */
  useDerived<U>(compute: (vm: this) => U, equality?: 'shallow'): U {
    const selector = () => compute(this);
    if (equality === 'shallow') {
      return useStore(this.store, useShallow(selector));
    }
    return useStore(this.store, selector);
  }
}
