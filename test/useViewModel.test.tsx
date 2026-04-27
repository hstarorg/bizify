import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ViewModelBase, useViewModel } from '../src';

class CounterVM extends ViewModelBase<{ count: number; other: number }> {
  protected $data() {
    return { count: 0, other: 0 };
  }
  plus = () => this.$set({ count: this.data.count + 1 });
  bumpOther = () => this.$set({ other: this.data.other + 1 });
}

describe('useViewModel', () => {
  it('renders initial state and updates on $set', () => {
    let vmRef: CounterVM | null = null;

    function View() {
      const vm = useViewModel(CounterVM);
      vmRef = vm;
      const count = vm.use((s) => s.count);
      return <div data-testid="count">{count}</div>;
    }

    render(<View />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    act(() => {
      vmRef!.plus();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('selector subscribes only to selected slice (no re-render on unrelated change)', () => {
    let vmRef: CounterVM | null = null;
    const renderSpy = vi.fn();

    function View() {
      const vm = useViewModel(CounterVM);
      vmRef = vm;
      const count = vm.use((s) => s.count);
      renderSpy();
      return <div data-testid="count">{count}</div>;
    }

    render(<View />);
    const initialRenders = renderSpy.mock.calls.length;

    act(() => {
      vmRef!.bumpOther();
    });
    expect(renderSpy.mock.calls.length).toBe(initialRenders);

    act(() => {
      vmRef!.plus();
    });
    expect(renderSpy.mock.calls.length).toBe(initialRenders + 1);
  });

  it('useDerived subscribes to a value computed from `this`', () => {
    class CartVM extends ViewModelBase<{ items: number[] }> {
      protected $data() {
        return { items: [] as number[] };
      }
      get total() {
        return this.data.items.reduce((s, n) => s + n, 0);
      }
      addItem = (n: number) => this.$set({ items: [...this.data.items, n] });
    }

    let vmRef: CartVM | null = null;

    function View() {
      const vm = useViewModel(CartVM);
      vmRef = vm;
      const total = vm.useDerived((v) => v.total);
      return <div data-testid="total">{total}</div>;
    }

    render(<View />);
    expect(screen.getByTestId('total')).toHaveTextContent('0');

    act(() => {
      vmRef!.addItem(10);
      vmRef!.addItem(20);
    });
    expect(screen.getByTestId('total')).toHaveTextContent('30');
  });

  it('use() with shallow equality avoids re-render when slice is shallow-equal', () => {
    let vmRef: CounterVM | null = null;
    const renderSpy = vi.fn();

    function View() {
      const vm = useViewModel(CounterVM);
      vmRef = vm;
      const slice = vm.use(
        (s) => ({ count: s.count }),
        'shallow',
      );
      renderSpy();
      return <div data-testid="count">{slice.count}</div>;
    }

    render(<View />);
    const initialRenders = renderSpy.mock.calls.length;

    act(() => {
      vmRef!.bumpOther();
    });
    expect(renderSpy.mock.calls.length).toBe(initialRenders);
  });

  it('lifecycle: onMount on render, onUnmount + onDispose on unmount', () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    const onDispose = vi.fn();

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
      protected onDispose() {
        onDispose();
      }
    }

    function View() {
      useViewModel(LifeVM);
      return null;
    }

    const { unmount } = render(<View />);
    expect(onMount).toHaveBeenCalledOnce();
    expect(onUnmount).not.toHaveBeenCalled();
    expect(onDispose).not.toHaveBeenCalled();

    unmount();
    expect(onUnmount).toHaveBeenCalledOnce();
    expect(onDispose).toHaveBeenCalledOnce();
  });
});
