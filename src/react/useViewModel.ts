import { useEffect, useRef, useState } from 'react';
import type { ViewModelBase } from './ViewModelBase';
import type { ViewModelState } from '../core/ViewModelBase';
import {
  createLifecycleBinding,
  type LifecycleBinding,
} from './lifecycleBinding';

/**
 * Create and bind a ViewModel to the current component. The instance is
 * created once on first render. `onMount` fires once after the component
 * is committed; `onUnmount` fires once when the component is truly gone.
 *
 * **StrictMode is invisible.** Even though React's `useEffect` is
 * intentionally double-invoked in dev (mount → cleanup → mount), bizify
 * coalesces this into a single logical mount via microtask reconciliation.
 * Subclasses can write `onMount` / `onUnmount` like Vue's hooks — they
 * fire exactly once per real page entry / exit.
 *
 * `dispose()` is *not* auto-called on unmount. Put view-tied cleanup in
 * `onUnmount`. Call `dispose()` explicitly only when you need a one-shot
 * teardown (tests, container/registry patterns).
 *
 * Use this for component-local state. For shared / SSR-friendly cases,
 * prefer `createViewModelContext`.
 */
export function useViewModel<
  T extends ViewModelState,
  VM extends ViewModelBase<T>,
>(Ctor: new () => VM): VM {
  const [vm] = useState(() => new Ctor());
  const bindingRef = useRef<LifecycleBinding | null>(null);
  if (bindingRef.current === null) {
    bindingRef.current = createLifecycleBinding(vm);
  }

  useEffect(() => {
    const binding = bindingRef.current!;
    binding.mount();
    return () => {
      binding.unmount();
    };
  }, [vm]);

  return vm;
}
