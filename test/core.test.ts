import { describe, it, expect, vi } from 'vitest';
import { ViewModelBase } from '../src/core';

class CounterVM extends ViewModelBase<{ count: number; label: string }> {
  protected $data() {
    return { count: 0, label: 'init' };
  }

  plus = () => this.$set({ count: this.data.count + 1 });
  setLabel = (label: string) => this.$set({ label });
  bump = () => this.$set((s) => ({ count: s.count + 1 }));
}

describe('core/ViewModelBase', () => {
  it('initializes from $data()', () => {
    const vm = new CounterVM();
    expect(vm['data']).toEqual({ count: 0, label: 'init' });
  });

  it('merges constructor initial over $data()', () => {
    class WithInitVM extends ViewModelBase<{ a: number; b: number }> {
      protected $data() {
        return { a: 1, b: 2 };
      }
    }
    const vm = new WithInitVM({ b: 99 });
    expect(vm['data']).toEqual({ a: 1, b: 99 });
  });

  it('$set with partial object merges into state', () => {
    const vm = new CounterVM();
    vm.plus();
    expect(vm['data'].count).toBe(1);
    expect(vm['data'].label).toBe('init');
  });

  it('$set with updater function reads previous state', () => {
    const vm = new CounterVM();
    vm.bump();
    vm.bump();
    expect(vm['data'].count).toBe(2);
  });

  it('$subscribe fires on state change with new and previous state', () => {
    const vm = new CounterVM();
    const listener = vi.fn();
    const unsub = vm.$subscribe(listener);
    vm.plus();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].count).toBe(1);
    expect(listener.mock.calls[0][1].count).toBe(0);
    unsub();
    vm.plus();
    expect(listener).toHaveBeenCalledTimes(1);
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

    vm.__mount(); // 0 -> 1: onMount
    vm.__mount(); // 1 -> 2
    expect(onMount).toHaveBeenCalledOnce();

    vm.__unmount(); // 2 -> 1
    expect(onUnmount).not.toHaveBeenCalled();

    vm.__unmount(); // 1 -> 0: onUnmount
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

  it('prototype methods are auto-bound to the instance', () => {
    class ProtoVM extends ViewModelBase<{ count: number }> {
      protected $data() {
        return { count: 0 };
      }
      plus() {
        this.$set({ count: this.data.count + 1 });
      }
      // Mixed: prototype method calling another prototype method
      plusBy(n: number) {
        this.$set({ count: this.data.count + n });
      }
    }

    const vm = new ProtoVM();
    const { plus, plusBy } = vm; // destructure — would lose `this` without auto-bind

    plus();
    expect(vm['data'].count).toBe(1);

    plusBy(5);
    expect(vm['data'].count).toBe(6);
  });

  it('subclass override of a prototype method is preserved by auto-bind', () => {
    class A extends ViewModelBase<{ tag: string }> {
      protected $data() {
        return { tag: '' };
      }
      greet() {
        this.$set({ tag: 'A' });
      }
    }
    class B extends A {
      greet() {
        this.$set({ tag: 'B' });
      }
    }

    const vm = new B();
    const fn = vm.greet;
    fn();
    expect(vm['data'].tag).toBe('B');
  });

  it('arrow class fields still take precedence over prototype methods', () => {
    class VM extends ViewModelBase<{ via: string }> {
      protected $data() {
        return { via: '' };
      }
      greet = () => this.$set({ via: 'arrow' });
      hello() {
        this.$set({ via: 'proto' });
      }
    }

    const vm = new VM();
    const { greet, hello } = vm;
    greet();
    expect(vm['data'].via).toBe('arrow');
    hello();
    expect(vm['data'].via).toBe('proto');
  });

  it('inherited base-class methods (e.g. dispose, $subscribe) are also bound', () => {
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
});
