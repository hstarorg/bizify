import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ViewModelBase, useViewModel } from '../src';

class CounterVM extends ViewModelBase<{ count: number; other: number }> {
  protected $data() {
    return { count: 0, other: 0 };
  }
  plus = () => {
    this.data.count += 1;
  };
  bumpOther = () => {
    this.data.other += 1;
  };
}

describe('useViewModel', () => {
  it('renders initial state and updates on mutation', async () => {
    let vmRef: CounterVM | null = null;

    function View() {
      const vm = useViewModel(CounterVM);
      vmRef = vm;
      const snap = vm.useSnapshot();
      return <div data-testid="count">{snap.count}</div>;
    }

    render(<View />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    await act(async () => {
      vmRef!.plus();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('auto-tracking: components only re-render when accessed fields change', async () => {
    let vmRef: CounterVM | null = null;
    const renderSpy = vi.fn();

    function View() {
      const vm = useViewModel(CounterVM);
      vmRef = vm;
      const snap = vm.useSnapshot();
      const count = snap.count; // only access count → only subscribe to count
      renderSpy();
      return <div data-testid="count">{count}</div>;
    }

    render(<View />);
    const initialRenders = renderSpy.mock.calls.length;

    // Mutating `other` should NOT trigger re-render — wasn't accessed
    await act(async () => {
      vmRef!.bumpOther();
    });
    expect(renderSpy.mock.calls.length).toBe(initialRenders);

    // Mutating `count` SHOULD trigger re-render
    await act(async () => {
      vmRef!.plus();
    });
    expect(renderSpy.mock.calls.length).toBe(initialRenders + 1);
  });

  it('computed getter in $data tracks dependencies through snapshot', async () => {
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
      addItem(n: number) {
        this.data.items.push(n);
      }
    }

    let vmRef: CartVM | null = null;

    function View() {
      const vm = useViewModel(CartVM);
      vmRef = vm;
      const snap = vm.useSnapshot();
      return <div data-testid="total">{snap.total}</div>;
    }

    render(<View />);
    expect(screen.getByTestId('total')).toHaveTextContent('0');

    await act(async () => {
      vmRef!.addItem(10);
      vmRef!.addItem(20);
    });
    expect(screen.getByTestId('total')).toHaveTextContent('30');
  });

  it('prototype methods can be passed directly as event handlers', async () => {
    class ProtoVM extends ViewModelBase<{ count: number }> {
      protected $data() {
        return { count: 0 };
      }
      increment() {
        this.data.count += 1;
      }
    }

    function View() {
      const vm = useViewModel(ProtoVM);
      const snap = vm.useSnapshot();
      return (
        <button data-testid="btn" onClick={vm.increment}>
          {snap.count}
        </button>
      );
    }

    render(<View />);
    expect(screen.getByTestId('btn')).toHaveTextContent('0');

    await act(async () => {
      screen.getByTestId('btn').click();
    });
    expect(screen.getByTestId('btn')).toHaveTextContent('1');
  });

  it('lifecycle: onMount on render, onUnmount + onDispose on unmount', async () => {
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
    await Promise.resolve();
    expect(onMount).toHaveBeenCalledOnce();
    expect(onUnmount).not.toHaveBeenCalled();
    expect(onDispose).not.toHaveBeenCalled();

    unmount();
    await Promise.resolve();
    expect(onUnmount).toHaveBeenCalledOnce();
    expect(onDispose).toHaveBeenCalledOnce();
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

    await Promise.resolve();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).toHaveBeenCalledTimes(0);

    unmount();
    await Promise.resolve();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it('nested mutation updates the view (valtio recursive proxy)', async () => {
    type State = { user: { profile: { name: string } } };
    class UserVM extends ViewModelBase<State> {
      protected $data(): State {
        return { user: { profile: { name: 'Tom' } } };
      }
      rename(name: string) {
        this.data.user.profile.name = name;
      }
    }

    let vmRef: UserVM | null = null;
    function View() {
      const vm = useViewModel(UserVM);
      vmRef = vm;
      const snap = vm.useSnapshot();
      return <div data-testid="name">{snap.user.profile.name}</div>;
    }

    render(<View />);
    expect(screen.getByTestId('name')).toHaveTextContent('Tom');

    await act(async () => {
      vmRef!.rename('Jerry');
    });
    expect(screen.getByTestId('name')).toHaveTextContent('Jerry');
  });
});

describe('useSnapshot sync option', () => {
  class FormVM extends ViewModelBase<{ text: string }> {
    protected $data() {
      return { text: '' };
    }
    setText(v: string) {
      this.data.text = v;
    }
  }

  it('controlled input keeps typed value (sync by default) — regression for dropped keystrokes', () => {
    function View() {
      const vm = useViewModel(FormVM);
      const snap = vm.useSnapshot();
      return (
        <input
          data-testid="inp"
          value={snap.text}
          onChange={(e) => vm.setText(e.target.value)}
        />
      );
    }

    render(<View />);
    const inp = screen.getByTestId('inp') as HTMLInputElement;

    // With valtio's async (microtask-batched) default, the re-render lands one
    // microtask late and React restores the controlled value — the keystroke
    // is lost. With bizify's sync default the value survives immediately.
    fireEvent.change(inp, { target: { value: 'hello' } });
    expect(inp.value).toBe('hello');
  });

  it('mutation is visible right after a synchronous act (no microtask wait)', () => {
    let vmRef: FormVM | null = null;
    function View() {
      const vm = useViewModel(FormVM);
      vmRef = vm;
      const snap = vm.useSnapshot();
      return <div data-testid="text">{snap.text}</div>;
    }

    render(<View />);
    act(() => {
      vmRef!.setText('now');
    });
    expect(screen.getByTestId('text')).toHaveTextContent('now');
  });

  it('sync: false opts back into valtio microtask batching', async () => {
    let vmRef: FormVM | null = null;
    function View() {
      const vm = useViewModel(FormVM);
      vmRef = vm;
      const snap = vm.useSnapshot({ sync: false });
      return <div data-testid="text">{snap.text}</div>;
    }

    render(<View />);
    // Batched: not yet visible right after a synchronous act…
    act(() => {
      vmRef!.setText('later');
    });
    expect(screen.getByTestId('text')).toHaveTextContent('');
    // …but lands once microtasks flush.
    await act(async () => {});
    expect(screen.getByTestId('text')).toHaveTextContent('later');
  });
});
