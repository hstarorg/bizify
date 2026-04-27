/**
 * Internal helper: bridges React's effect lifecycle (which can fire
 * mount → cleanup → mount synchronously under StrictMode or discarded
 * concurrent commits) into a clean "mounted once / unmounted once"
 * contract on the underlying ViewModel.
 *
 * Strategy: don't call vm.__mount / vm.__unmount synchronously from the
 * effect. Track a desired state, schedule a microtask, and reconcile
 * to the final state once the synchronous burst settles.
 *
 * Effect:
 *   - StrictMode's mount → cleanup → mount collapses to a single onMount
 *   - A discarded commit (mount → cleanup, no remount) collapses to
 *     no lifecycle calls at all
 *   - A real mount fires onMount once on the next microtask
 *   - A real unmount fires onUnmount once on the next microtask
 */
interface VmBinding {
  __mount(): void;
  __unmount(): void;
}

export interface LifecycleBinding {
  /** Call from useEffect setup. */
  mount(): void;
  /** Call from useEffect cleanup. */
  unmount(): void;
}

export function createLifecycleBinding(vm: VmBinding): LifecycleBinding {
  let actualMounted = false;
  let desired = false;
  let scheduled = false;

  function reconcile(): void {
    scheduled = false;
    if (desired === actualMounted) return;
    if (desired) {
      vm.__mount();
      actualMounted = true;
    } else {
      vm.__unmount();
      actualMounted = false;
    }
  }

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(reconcile);
  }

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
