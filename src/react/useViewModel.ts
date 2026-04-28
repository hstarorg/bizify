import { useEffect, useState } from 'react';
import type { ViewModelBase } from './ViewModelBase';
import { createLifecycleBinding } from './lifecycleBinding';

/**
 * Create a component-local ViewModel. Lifecycle is StrictMode-safe:
 * `onMount` / `onUnmount` fire exactly once per real mount/unmount.
 * For shared / SSR cases, prefer `createViewModelContext`.
 */
export function useViewModel<VM extends ViewModelBase<any>>(
  Ctor: new () => VM,
): VM {
  const [{ vm, binding }] = useState(() => {
    const vm = new Ctor();
    return { vm, binding: createLifecycleBinding(vm) };
  });

  useEffect(() => {
    binding.mount();
    return binding.unmount;
  }, [binding]);

  return vm;
}
