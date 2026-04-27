import { proxy, subscribe } from 'valtio/vanilla';
import { subscribeKey } from 'valtio/utils';

export type ViewModelState = Record<string, unknown>;

// Per-instance lifecycle state lives in a module-level WeakMap so the VM
// instance has zero internal own properties — `vm.` autocomplete stays clean.
const states = new WeakMap<
  ViewModelBase<any>,
  { mountCount: number; disposed: boolean }
>();

// onMount/onUnmount are protected; framework boundary needs to call them
// via structural cast so renames still type-check.
type LifecycleHooks = { onMount(): void; onUnmount(): void };

/** @internal Framework-only. */
export function _vmMount(vm: ViewModelBase<any>): void {
  const s = states.get(vm)!;
  if (s.disposed) return;
  if (s.mountCount === 0) (vm as unknown as LifecycleHooks).onMount();
  s.mountCount++;
}

/** @internal Framework-only. */
export function _vmUnmount(vm: ViewModelBase<any>): void {
  const s = states.get(vm)!;
  if (s.disposed || s.mountCount === 0) return;
  s.mountCount--;
  if (s.mountCount === 0) (vm as unknown as LifecycleHooks).onUnmount();
}

/**
 * ViewModel base class, backed by valtio.
 *
 * - `data` is a protected proxy. Mutate it directly inside VM methods.
 * - Computed properties: declare them as getters in the `$data()` return.
 * - Lifecycle: `onInit` (construction) / `onMount` / `onUnmount` /
 *   `onDispose` (only when `$dispose()` is called explicitly).
 * - Under React 18 StrictMode, `onMount` / `onUnmount` are coalesced to
 *   fire exactly once per real cycle (microtask reconciliation in the
 *   React layer).
 */
export abstract class ViewModelBase<T extends ViewModelState> {
  protected readonly data: T;

  constructor(initial?: Partial<T>) {
    // defineProperties preserves accessor descriptors from $data() so
    // computed getters survive the proxy wrapping (spread/assign would
    // freeze them to one-shot snapshots).
    const seed: Record<string, unknown> = {};
    Object.defineProperties(
      seed,
      Object.getOwnPropertyDescriptors(this.$data()),
    );
    if (initial) Object.assign(seed, initial);
    this.data = proxy(seed) as T;

    states.set(this, { mountCount: 0, disposed: false });
    this.autoBindMethods();
    this.onInit();
  }

  protected abstract $data(): T;

  protected $subscribe(listener: () => void): () => void {
    return subscribe(this.data, listener);
  }

  protected $watch<K extends keyof T>(
    key: K,
    listener: (value: T[K]) => void,
  ): () => void {
    return subscribeKey(
      this.data,
      key as string,
      listener as (v: unknown) => void,
    );
  }

  protected onInit(): void {}
  protected onMount(): void {}
  protected onUnmount(): void {}
  protected onDispose(): void {}

  /** Tear down the instance. Idempotent. Triggers `onDispose`. */
  $dispose(): void {
    const s = states.get(this);
    if (!s || s.disposed) return;
    s.disposed = true;
    this.onDispose();
  }

  /**
   * Bind every prototype method to `this` as a non-enumerable own
   * property, so methods survive destructuring / event-handler passing.
   */
  private autoBindMethods(): void {
    let proto: object | null = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        if (Object.prototype.hasOwnProperty.call(this, name)) continue;
        const desc = Object.getOwnPropertyDescriptor(proto, name)!;
        if (typeof desc.value !== 'function') continue;
        Object.defineProperty(this, name, {
          value: desc.value.bind(this),
          writable: true,
          configurable: true,
        });
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
}
