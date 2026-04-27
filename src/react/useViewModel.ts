import { useEffect, useState } from 'react';
import type { ViewModelBase } from './ViewModelBase';
import type { ViewModelState } from '../core/ViewModelBase';

/**
 * Create and bind a ViewModel to the current component. The instance is
 * created once on first render. `onMount` fires after the first effect,
 * `onUnmount` on unmount.
 *
 * **Note**: `dispose()` is *not* auto-called on unmount, to keep the binding
 * safe under React 18 StrictMode (which intentionally double-invokes
 * effects in dev). Put view-tied cleanup in `onUnmount`. The instance is
 * discarded by GC when the component is gone.
 *
 * Use this for component-local state. For shared / SSR-friendly cases,
 * prefer `createViewModelContext`.
 */
export function useViewModel<
  T extends ViewModelState,
  VM extends ViewModelBase<T>,
>(Ctor: new () => VM): VM {
  const [vm] = useState(() => new Ctor());

  useEffect(() => {
    vm.__mount();
    return () => {
      vm.__unmount();
    };
  }, [vm]);

  return vm;
}
