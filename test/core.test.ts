import { describe, it, expect, vi } from 'vitest';
import { ViewModelBase, dispose, isDisposed } from '../src/core';
// 测试要触发生命周期需要这俩 internal 函数——它们故意不从公开入口暴露,
// 测试直接从源文件取。
import { _vmMount, _vmUnmount } from '../src/core/ViewModelBase';

// ─── test helpers ─────────────────────────────────────────────────
// VM 的 data / $subscribe / $watch / 内部 mount/unmount 都不对外开放,
// 测试要内省直接 cast 拿到。
type Peek = <T>(vm: ViewModelBase<any>) => T;
const peek: Peek = (vm) => (vm as any).data;
const sub = (vm: ViewModelBase<any>, cb: () => void): (() => void) =>
  (vm as any).$subscribe(cb);
const watch = (
  vm: ViewModelBase<any>,
  source: string | (() => unknown),
  cb: (value: unknown, oldValue: unknown) => void,
  options?: { immediate?: boolean },
): (() => void) => (vm as any).$watch(source, cb, options);
const onCleanup = (vm: ViewModelBase<any>, fn: () => void): (() => void) =>
  (vm as any).$onCleanup(fn);

class CounterVM extends ViewModelBase<{ count: number; label: string }> {
  protected $data() {
    return { count: 0, label: 'init' };
  }

  plus = () => {
    this.data.count += 1;
  };

  setLabel(label: string) {
    this.data.label = label;
  }

  bumpBy(n: number) {
    this.data.count += n;
  }
}

describe('core/ViewModelBase', () => {
  it('initializes data from $data()', () => {
    const vm = new CounterVM();
    expect(peek<{ count: number; label: string }>(vm).count).toBe(0);
    expect(peek<{ count: number; label: string }>(vm).label).toBe('init');
  });

  it('merges constructor initial over $data()', () => {
    class WithInitVM extends ViewModelBase<{ a: number; b: number }> {
      protected $data() {
        return { a: 1, b: 2 };
      }
    }
    const vm = new WithInitVM({ b: 99 });
    expect(peek<{ a: number; b: number }>(vm).a).toBe(1);
    expect(peek<{ a: number; b: number }>(vm).b).toBe(99);
  });

  it('direct mutation triggers subscriptions (async batched)', async () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = sub(vm, listener);

    vm.plus();
    await Promise.resolve();
    expect(listener).toHaveBeenCalled();

    const callsBefore = listener.mock.calls.length;
    unsub();
    vm.plus();
    await Promise.resolve();
    expect(listener.mock.calls.length).toBe(callsBefore);
  });

  it('prototype methods can mutate this.data', () => {
    const vm = new CounterVM();
    vm.bumpBy(5);
    expect(peek<{ count: number }>(vm).count).toBe(5);
    vm.setLabel('done');
    expect(peek<{ label: string }>(vm).label).toBe('done');
  });

  it('$watch by key fires with (newVal, oldVal)', async () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = watch(vm, 'count', listener);

    vm.plus();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledWith(1, 0);

    vm.plus();
    await Promise.resolve();
    expect(listener).toHaveBeenLastCalledWith(2, 1);

    listener.mockClear();
    vm.setLabel('foo');
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();

    unsub();
  });

  it('$watch by getter fires on nested change with (newVal, oldVal)', async () => {
    type S = { user: { name: string }; misc: number };
    class VM extends ViewModelBase<S> {
      protected $data(): S {
        return { user: { name: 'Tom' }, misc: 0 };
      }
      rename(name: string) {
        this.data.user.name = name;
      }
      bumpMisc() {
        this.data.misc += 1;
      }
    }
    const vm = new VM();
    const listener = vi.fn();
    const unsub = watch(vm, () => (vm as any).data.user.name, listener);

    vm.rename('Jerry');
    await Promise.resolve();
    expect(listener).toHaveBeenCalledWith('Jerry', 'Tom');

    // Object.is filter: unrelated mutation does not fire
    listener.mockClear();
    vm.bumpMisc();
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();

    unsub();
  });

  it('$watch immediate fires once with (current, undefined) at register', async () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = watch(vm, 'count', listener, { immediate: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(0, undefined);

    vm.plus();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(1, 0);

    unsub();
  });

  it('$watch immediate works with getter form too', () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = watch(
      vm,
      () => (vm as any).data.count + 100,
      listener,
      { immediate: true },
    );

    expect(listener).toHaveBeenCalledWith(100, undefined);
    unsub();
  });

  it('$watch returned unsubscribe is idempotent', async () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = watch(vm, 'count', listener);

    unsub();
    unsub(); // second call must not throw

    vm.plus();
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
  });

  it('initial does not overwrite computed getters from $data', () => {
    type State = { items: number[]; readonly total: number };
    class CartVM extends ViewModelBase<State> {
      protected $data(): State {
        return {
          items: [],
          get total() {
            return this.items.reduce((s, n) => s + n, 0);
          },
        };
      }
      add(n: number) {
        this.data.items.push(n);
      }
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Forcibly pass `total` as initial — should be skipped, getter preserved.
    const vm = new CartVM({ items: [1, 2], total: 999 } as Partial<State>);
    expect(peek<State>(vm).total).toBe(3);
    vm.add(4);
    expect(peek<State>(vm).total).toBe(7);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('initial.total ignored'),
    );
    warn.mockRestore();
  });

  it('computed getter declared in $data is reactive on the proxy', () => {
    type CartState = {
      items: number[];
      readonly total: number;
    };
    class CartVM extends ViewModelBase<CartState> {
      protected $data(): CartState {
        return {
          items: [],
          get total() {
            return this.items.reduce((s, n) => s + n, 0);
          },
        };
      }
      add(n: number) {
        this.data.items.push(n);
      }
    }

    const vm = new CartVM();
    expect(peek<CartState>(vm).total).toBe(0);
    vm.add(5);
    expect(peek<CartState>(vm).total).toBe(5);
    vm.add(10);
    expect(peek<CartState>(vm).total).toBe(15);
  });

  it('lifecycle: onInit fires on construction', () => {
    const onInit = vi.fn();
    class LifeVM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      protected onInit() {
        onInit();
      }
    }
    const vm = new LifeVM();
    expect(vm).toBeDefined();
    expect(onInit).toHaveBeenCalledOnce();
  });

  it('lifecycle: onMount fires on first mount, onUnmount on last unmount', () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    class LifeVM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      protected onMount() {
        onMount();
      }
      protected onUnmount() {
        onUnmount();
      }
    }
    const vm = new LifeVM();

    _vmMount(vm);
    _vmMount(vm);
    expect(onMount).toHaveBeenCalledOnce();

    _vmUnmount(vm);
    expect(onUnmount).not.toHaveBeenCalled();

    _vmUnmount(vm);
    expect(onUnmount).toHaveBeenCalledOnce();
  });

  it('$dispose() fires onDispose once and is idempotent', () => {
    const onDispose = vi.fn();
    class LifeVM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      protected onDispose() {
        onDispose();
      }
    }
    const vm = new LifeVM();
    dispose(vm);
    dispose(vm);
    expect(onDispose).toHaveBeenCalledOnce();
  });

  it('$dispose() while mounted fires onUnmount before onDispose', () => {
    const calls: string[] = [];
    class LifeVM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      protected onUnmount() {
        calls.push('unmount');
      }
      protected onDispose() {
        calls.push('dispose');
      }
    }
    const vm = new LifeVM();
    _vmMount(vm);
    dispose(vm);
    expect(calls).toEqual(['unmount', 'dispose']);
  });

  it('$disposed reflects lifecycle state', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
    }
    const vm = new VM();
    expect(isDisposed(vm)).toBe(false);
    dispose(vm);
    expect(isDisposed(vm)).toBe(true);
  });

  it('$subscribe / $watch are auto-drained at $dispose', async () => {
    const subListener = vi.fn();
    const watchListener = vi.fn();
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      bump() {
        this.data.x += 1;
      }
    }
    const vm = new VM();
    sub(vm, subListener);
    watch(vm, 'x', watchListener);

    vm.bump();
    await Promise.resolve();
    expect(subListener).toHaveBeenCalled();
    expect(watchListener).toHaveBeenCalled();

    dispose(vm);
    subListener.mockClear();
    watchListener.mockClear();

    vm.bump();
    await Promise.resolve();
    expect(subListener).not.toHaveBeenCalled();
    expect(watchListener).not.toHaveBeenCalled();
  });

  it('$onCleanup remover is idempotent and drains at $dispose', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
    }
    const vm = new VM();

    const cleanupA = vi.fn();
    const remove = onCleanup(vm, cleanupA);
    remove();
    expect(cleanupA).toHaveBeenCalledOnce();
    remove();
    expect(cleanupA).toHaveBeenCalledOnce();

    const cleanupB = vi.fn();
    onCleanup(vm, cleanupB);
    dispose(vm);
    expect(cleanupB).toHaveBeenCalledOnce();
  });

  it('$onCleanup post-$dispose runs the fn immediately', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
    }
    const vm = new VM();
    dispose(vm);

    const fn = vi.fn();
    onCleanup(vm, fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('cleanups drain in LIFO order at $dispose', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
    }
    const vm = new VM();
    const order: string[] = [];
    onCleanup(vm, () => order.push('A'));
    onCleanup(vm, () => order.push('B'));
    onCleanup(vm, () => order.push('C'));
    dispose(vm);
    expect(order).toEqual(['C', 'B', 'A']);
  });

  it('a throwing cleanup does not block subsequent cleanups', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
    }
    const vm = new VM();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cleanA = vi.fn(() => {
      throw new Error('boom');
    });
    const cleanB = vi.fn();
    onCleanup(vm, cleanA);
    onCleanup(vm, cleanB);
    dispose(vm);
    expect(cleanA).toHaveBeenCalled();
    expect(cleanB).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(
      '[bizify] cleanup error:',
      expect.any(Error),
    );
    errSpy.mockRestore();
  });

  it('disposed VM ignores subsequent mount', () => {
    const onMount = vi.fn();
    class LifeVM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      protected onMount() {
        onMount();
      }
    }
    const vm = new LifeVM();
    dispose(vm);
    _vmMount(vm);
    expect(onMount).not.toHaveBeenCalled();
  });

  it('prototype methods are auto-bound to the instance', () => {
    class ProtoVM extends ViewModelBase<{ count: number }> {
      protected $data() {
        return { count: 0 };
      }
      plus() {
        this.data.count += 1;
      }
      plusBy(n: number) {
        this.data.count += n;
      }
    }

    const vm = new ProtoVM();
    const { plus, plusBy } = vm;

    plus();
    expect(peek<{ count: number }>(vm).count).toBe(1);

    plusBy(5);
    expect(peek<{ count: number }>(vm).count).toBe(6);
  });

  it('subclass override of a prototype method is preserved by auto-bind', () => {
    class A extends ViewModelBase<{ tag: string }> {
      protected $data() {
        return { tag: '' };
      }
      greet() {
        this.data.tag = 'A';
      }
    }
    class B extends A {
      greet() {
        this.data.tag = 'B';
      }
    }

    const vm = new B();
    const fn = vm.greet;
    fn();
    expect(peek<{ tag: string }>(vm).tag).toBe('B');
  });

  it('arrow class fields still take precedence over prototype methods', () => {
    class VM extends ViewModelBase<{ via: string }> {
      protected $data() {
        return { via: '' };
      }
      greet = () => {
        this.data.via = 'arrow';
      };
      hello() {
        this.data.via = 'proto';
      }
    }

    const vm = new VM();
    const { greet, hello } = vm;
    greet();
    expect(peek<{ via: string }>(vm).via).toBe('arrow');
    hello();
    expect(peek<{ via: string }>(vm).via).toBe('proto');
  });

  it('user-defined methods are auto-bound and destructure-safe', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      bump() {
        this.data.x += 1;
      }
    }
    const vm = new VM();

    // user methods bind so destructured calls keep `this`. Framework
    // `$`-prefixed methods are NOT bound — call them via `vm.method()`.
    const { bump } = vm;
    bump();
    expect(peek<{ x: number }>(vm).x).toBe(1);
  });

  it('VM 实例对外不暴露任何 internal API(反向断言)', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      myMethod() {}
    }
    const vm = new VM();

    // 不应该挂在实例上的内部状态
    expect((vm as any).mountCount).toBeUndefined();
    expect((vm as any).disposed).toBeUndefined();
    expect((vm as any).mount).toBeUndefined();
    expect((vm as any).unmount).toBeUndefined();
    expect((vm as any).VM_MOUNT).toBeUndefined();
    expect((vm as any).VM_UNMOUNT).toBeUndefined();
    expect((vm as any)._vmMount).toBeUndefined();
    expect((vm as any)._vmUnmount).toBeUndefined();

    // 实例上没有任何 own symbol 键(以前 Symbol-keyed 方法的痕迹)
    expect(Object.getOwnPropertySymbols(vm)).toHaveLength(0);

    // 实例 own keys 只该有:data + autoBind 写入的方法名(myMethod 等)
    const ownKeys = Object.getOwnPropertyNames(vm).sort();
    // data 必须在,框架内部状态字段一律不在
    expect(ownKeys).toContain('data');
    expect(ownKeys).toContain('myMethod');
    expect(ownKeys).not.toContain('mountCount');
    expect(ownKeys).not.toContain('disposed');
    expect(ownKeys).not.toContain('mount');
    expect(ownKeys).not.toContain('unmount');
  });
});
