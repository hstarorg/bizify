import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
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

  it('lifecycle: onMount fires once after render, onUnmount fires once after unmount', async () => {
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
    // Lifecycle is reconciled on the next microtask.
    await Promise.resolve();
    expect(onMount).toHaveBeenCalledOnce();
    expect(onUnmount).not.toHaveBeenCalled();

    unmount();
    await Promise.resolve();
    expect(onUnmount).toHaveBeenCalledOnce();
    // onDispose is intentionally not auto-called by useViewModel.
    expect(onDispose).not.toHaveBeenCalled();
  });

  it('StrictMode: onMount and onUnmount each fire exactly once (Vue-like)', async () => {
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

    function View() {
      useViewModel(LifeVM);
      return null;
    }

    const { unmount } = render(
      <StrictMode>
        <View />
      </StrictMode>,
    );

    // React fires effect → cleanup → effect synchronously in StrictMode.
    // Microtask reconciliation collapses this into a single onMount.
    await Promise.resolve();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).toHaveBeenCalledTimes(0);

    unmount();
    await Promise.resolve();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it('prototype methods can be passed directly as event handlers', () => {
    class ProtoVM extends ViewModelBase<{ count: number }> {
      protected $data() {
        return { count: 0 };
      }
      // Note: NOT an arrow function — plain prototype method
      increment() {
        this.$set({ count: this.data.count + 1 });
      }
    }

    function View() {
      const vm = useViewModel(ProtoVM);
      const count = vm.use((s) => s.count);
      // Pass the raw prototype method; auto-bind makes `this` correct
      return (
        <button data-testid="btn" onClick={vm.increment}>
          {count}
        </button>
      );
    }

    render(<View />);
    expect(screen.getByTestId('btn')).toHaveTextContent('0');

    act(() => {
      screen.getByTestId('btn').click();
    });
    expect(screen.getByTestId('btn')).toHaveTextContent('1');
  });

  it('useDerived with shallow equality skips re-render when computed slice is shallow-equal', () => {
    class CartVM extends ViewModelBase<{
      items: { id: number; name: string }[];
      filter: string;
    }> {
      protected $data() {
        return { items: [{ id: 1, name: 'a' }], filter: '' };
      }
      get visible() {
        return this.data.items.filter((i) => i.name.includes(this.data.filter));
      }
      bumpFilter = () => this.$set({ filter: this.data.filter });
      addItem = (item: { id: number; name: string }) =>
        this.$set((s) => ({ items: [...s.items, item] }));
    }

    let vmRef: CartVM | null = null;
    const renderSpy = vi.fn();

    function View() {
      const vm = useViewModel(CartVM);
      vmRef = vm;
      const visible = vm.useDerived((v) => v.visible, 'shallow');
      renderSpy();
      return <div data-testid="count">{visible.length}</div>;
    }

    render(<View />);
    const initialRenders = renderSpy.mock.calls.length;

    // Re-running the same selector returns a new array reference but
    // identical content. With 'shallow', no re-render.
    act(() => {
      vmRef!.bumpFilter();
    });
    expect(renderSpy.mock.calls.length).toBe(initialRenders);

    // Adding an item changes the result → re-render.
    act(() => {
      vmRef!.addItem({ id: 2, name: 'b' });
    });
    expect(renderSpy.mock.calls.length).toBe(initialRenders + 1);
  });
});
