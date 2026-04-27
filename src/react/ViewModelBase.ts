import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  ViewModelBase as CoreViewModelBase,
  type ViewModelState,
} from '../core/ViewModelBase';

/**
 * React ViewModel base class.
 *
 * Extends the framework-agnostic core with React hooks:
 *   - `use(selector)`        fine-grained subscription with optional shallow eq
 *   - `useDerived(fn)`       subscribe to a derived value computed from `this`
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
  /** Subscribe to the entire state. Re-renders on any change. */
  use(): T;
  use<U>(selector?: (state: T) => U, equality?: 'shallow'): U | T {
    if (!selector) {
      return useStore(this.store);
    }
    if (equality === 'shallow') {
      return useStore(this.store, useShallow(selector));
    }
    return useStore(this.store, selector);
  }

  /**
   * Subscribe to a value derived from this ViewModel (e.g. a class getter).
   * Re-renders when the returned value changes (Object.is comparison).
   */
  useDerived<U>(compute: (vm: this) => U): U {
    return useStore(this.store, () => compute(this));
  }
}
