import { useEffect, useState } from 'react';
import type { ViewModelBase } from './ViewModelBase';
import type { ViewModelState } from '../core/ViewModelBase';

/**
 * Create and bind a ViewModel to the current component. The instance lives
 * for the component's lifetime: `onMount` fires after the first render,
 * `onUnmount` + `dispose` fire on unmount.
 *
 * Use this for component-local state (forms, detail pages, wizards). For
 * shared / SSR-friendly cases, prefer `createViewModelContext`.
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
      vm.dispose();
    };
  }, [vm]);

  return vm;
}
