import { useEffect, useState } from 'react';
import type { ViewModelBase } from './ViewModelBase';
import type { ViewModelState } from '../core/ViewModelBase';
import { createLifecycleBinding } from './lifecycleBinding';

/**
 * Create a component-local ViewModel. Lifecycle is StrictMode-safe:
 * `onMount` / `onUnmount` fire exactly once per real mount/unmount.
 * For shared / SSR cases, prefer `createViewModelContext`.
 */
export function useViewModel<
  T extends ViewModelState,
  VM extends ViewModelBase<T>,
>(Ctor: new () => VM): VM {
  const [vm] = useState(() => new Ctor());
  const [binding] = useState(() => createLifecycleBinding(vm));

  useEffect(() => {
    binding.mount();
    return binding.unmount;
  }, [binding]);

  return vm;
}
