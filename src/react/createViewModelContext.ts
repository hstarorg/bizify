import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { ViewModelBase } from './ViewModelBase';
import type { ViewModelState } from '../core/ViewModelBase';

export interface ViewModelProviderProps<T extends ViewModelState> {
  /**
   * Initial state to merge into the ViewModel on construction.
   *
   * Read **only on the first render** of the Provider. Changing this prop
   * later does not rebuild the ViewModel — by design, to keep SSR hydration
   * stable. If you need to swap state, expose a method on the ViewModel.
   */
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
 * Create a Provider + hook pair for a ViewModel. The Provider creates one
 * instance for its subtree (lifetime tied to the Provider), and `useVM()`
 * grabs it from context.
 *
 * Use this for:
 *   - subtree-shared ViewModels (e.g. a Cart shared across cart-page children)
 *   - SSR (each request constructs its own instance via the Provider)
 *   - app-wide singletons (mount the Provider at the app root)
 *
 * **Note**: `dispose()` is *not* auto-called on Provider unmount, to stay
 * safe under React 18 StrictMode. Put cleanup in `onUnmount`. Call
 * `dispose()` explicitly only when you need a one-shot teardown.
 */
export function createViewModelContext<
  T extends ViewModelState,
  VM extends ViewModelBase<T>,
>(Ctor: new (initial?: Partial<T>) => VM): ViewModelContext<T, VM> {
  const Ctx = createContext<VM | null>(null);

  function Provider({ initial, children }: ViewModelProviderProps<T>) {
    const [vm] = useState(() => new Ctor(initial));

    useEffect(() => {
      vm.__mount();
      return () => {
        vm.__unmount();
      };
    }, [vm]);

    return createElement(Ctx.Provider, { value: vm }, children);
  }

  function useVM(): VM {
    const vm = useContext(Ctx);
    if (!vm) {
      throw new Error(
        `[bizify] useVM() called outside of its Provider. Wrap your tree in <Provider>.`,
      );
    }
    return vm;
  }

  return { Provider, useVM };
}
