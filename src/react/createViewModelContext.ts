import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { ViewModelBase } from './ViewModelBase';
import type { StateOf, ViewModelState } from '../core/ViewModelBase';
import { createLifecycleBinding } from './lifecycleBinding';

export interface ViewModelProviderProps<T extends ViewModelState> {
  /** Initial state overrides — read once on first render only (SSR-safe). */
  initial?: Partial<T>;
  children: ReactNode;
}

export interface ViewModelContext<
  T extends ViewModelState,
  VM extends ViewModelBase<T>,
> {
  Provider: (props: ViewModelProviderProps<T>) => ReactNode;
  useVM: () => VM;
}

/**
 * Provider + useVM hook for sharing a VM across a subtree (also the
 * recommended SSR pattern — each request gets its own Provider/VM).
 */
export function createViewModelContext<VM extends ViewModelBase<any>>(
  Ctor: new (initial?: Partial<StateOf<VM>>) => VM,
): ViewModelContext<StateOf<VM>, VM> {
  const Ctx = createContext<VM | null>(null);

  function Provider({
    initial,
    children,
  }: ViewModelProviderProps<StateOf<VM>>) {
    const [{ vm, binding }] = useState(() => {
      const vm = new Ctor(initial);
      return { vm, binding: createLifecycleBinding(vm) };
    });

    useEffect(() => {
      binding.mount();
      return binding.unmount;
    }, [binding]);

    return createElement(Ctx.Provider, { value: vm }, children);
  }

  function useVM(): VM {
    const vm = useContext(Ctx);
    if (!vm) {
      throw new Error('[bizify] useVM() called outside of its Provider.');
    }
    return vm;
  }

  return { Provider, useVM };
}
