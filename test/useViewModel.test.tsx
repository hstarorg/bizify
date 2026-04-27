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

  it('lifecycle: onMount on render, onUnmount on unmount, onDispose NOT auto-called', () => {
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

    unmount();
    expect(onUnmount).toHaveBeenCalledOnce();
    // onDispose is intentionally not auto-called by useViewModel — keeps the
    // binding safe under React 18 StrictMode.
    expect(onDispose).not.toHaveBeenCalled();
  });

  it('StrictMode: onMount fires after each remount cycle', () => {
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

    // Under StrictMode, useEffect runs twice in dev: mount → cleanup → mount.
    // Both onMount calls must fire (i.e. the second mount is not swallowed
    // by a stale `disposed` flag).
    expect(onMount).toHaveBeenCalledTimes(2);
    expect(onUnmount).toHaveBeenCalledTimes(1);

    unmount();
    expect(onMount).toHaveBeenCalledTimes(2);
    expect(onUnmount).toHaveBeenCalledTimes(2);
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
