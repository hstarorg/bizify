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
