import { describe, it, expect, vi } from 'vitest';
import { ViewModelBase } from '../src/core';

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
    expect(vm.data.count).toBe(0);
    expect(vm.data.label).toBe('init');
  });

  it('merges constructor initial over $data()', () => {
    class WithInitVM extends ViewModelBase<{ a: number; b: number }> {
      protected $data() {
        return { a: 1, b: 2 };
      }
    }
    const vm = new WithInitVM({ b: 99 });
    expect(vm.data.a).toBe(1);
    expect(vm.data.b).toBe(99);
  });

  it('direct mutation triggers subscriptions (async batched)', async () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = vm.$subscribe(listener);

    vm.plus();
    // valtio's subscribe is async — it batches notifications to the next microtask
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
    expect(vm.data.count).toBe(5);
    vm.setLabel('done');
    expect(vm.data.label).toBe('done');
  });

  it('$watch fires on specific key change with new value', async () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = vm.$watch('count', listener);

    vm.plus();
    // valtio's subscribeKey is async (microtask) — wait for it
    await Promise.resolve();
    expect(listener).toHaveBeenCalledWith(1);

    // changing label should not trigger count watcher
    listener.mockClear();
    vm.setLabel('foo');
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();

    unsub();
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
    expect(vm.data.total).toBe(0);
    vm.add(5);
    expect(vm.data.total).toBe(5);
    vm.add(10);
    expect(vm.data.total).toBe(15);
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

  it('lifecycle: onMount fires on first __mount, onUnmount on last __unmount', () => {
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

    vm.__mount();
    vm.__mount();
    expect(onMount).toHaveBeenCalledOnce();

    vm.__unmount();
    expect(onUnmount).not.toHaveBeenCalled();

    vm.__unmount();
    expect(onUnmount).toHaveBeenCalledOnce();
  });

  it('dispose() fires onDispose once and is idempotent', () => {
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
    vm.dispose();
    vm.dispose();
    expect(onDispose).toHaveBeenCalledOnce();
  });

  it('disposed VM ignores __mount / __unmount', () => {
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
    vm.dispose();
    vm.__mount();
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
    expect(vm.data.count).toBe(1);

    plusBy(5);
    expect(vm.data.count).toBe(6);
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
    expect(vm.data.tag).toBe('B');
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
    expect(vm.data.via).toBe('arrow');
    hello();
    expect(vm.data.via).toBe('proto');
  });

  it('inherited base-class methods are auto-bound', () => {
    class VM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
    }
    const vm = new VM();
    const dispose = vm.dispose;
    const subscribe = vm.$subscribe;

    const listener = vi.fn();
    const unsub = subscribe(listener);
    expect(typeof unsub).toBe('function');
    unsub();

    expect(() => dispose()).not.toThrow();
  });
});
