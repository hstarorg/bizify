import { _vmMount, _vmUnmount, type ViewModelBase } from '../core/ViewModelBase';

export interface LifecycleBinding {
  mount(): void;
  unmount(): void;
}

/**
 * Coalesce React's mount → cleanup → mount bursts (StrictMode dev-mode,
 * discarded concurrent commits, Suspense remounts) into a single
 * `onMount` / `onUnmount` cycle. Track desired state synchronously,
 * reconcile on the next microtask.
 */
export function createLifecycleBinding(
  vm: ViewModelBase<any>,
): LifecycleBinding {
  let mounted = false;
  let desired = false;
  let scheduled = false;

  const reconcile = () => {
    scheduled = false;
    if (desired === mounted) return;
    if (desired) {
      _vmMount(vm);
      mounted = true;
    } else {
      _vmUnmount(vm);
      mounted = false;
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(reconcile);
  };

  return {
    mount() {
      desired = true;
      schedule();
    },
    unmount() {
      desired = false;
      schedule();
    },
  };
}
