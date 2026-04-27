import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ViewModelBase, createViewModelContext } from '../src';

class CartVM extends ViewModelBase<{ items: string[] }> {
  protected $data() {
    return { items: [] as string[] };
  }
  add = (item: string) => this.$set({ items: [...this.data.items, item] });
}

describe('createViewModelContext', () => {
  it('Provider creates one VM shared across the subtree', () => {
    const { Provider, useVM } = createViewModelContext(CartVM);

    function Header() {
      const vm = useVM();
      const count = vm.use((s) => s.items.length);
      return <div data-testid="header">{count}</div>;
    }

    let vmRef: CartVM | null = null;
    function Body() {
      const vm = useVM();
      vmRef = vm;
      const items = vm.use((s) => s.items);
      return <div data-testid="body">{items.join(',')}</div>;
    }

    render(
      <Provider>
        <Header />
        <Body />
      </Provider>,
    );

    expect(screen.getByTestId('header')).toHaveTextContent('0');
    expect(screen.getByTestId('body')).toHaveTextContent('');

    act(() => {
      vmRef!.add('apple');
    });
    expect(screen.getByTestId('header')).toHaveTextContent('1');
    expect(screen.getByTestId('body')).toHaveTextContent('apple');
  });

  it('Provider accepts initial state', () => {
    const { Provider, useVM } = createViewModelContext(CartVM);

    function View() {
      const items = useVM().use((s) => s.items);
      return <div data-testid="v">{items.join(',')}</div>;
    }

    render(
      <Provider initial={{ items: ['preloaded'] }}>
        <View />
      </Provider>,
    );

    expect(screen.getByTestId('v')).toHaveTextContent('preloaded');
  });

  it('useVM throws when used outside Provider', () => {
    const { useVM } = createViewModelContext(CartVM);

    function View() {
      useVM();
      return null;
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<View />)).toThrow(/Provider/);
    consoleError.mockRestore();
  });

  it('Provider unmount disposes the VM', () => {
    const onDispose = vi.fn();

    class LifeVM extends ViewModelBase<{ x: number }> {
      protected $data() {
        return { x: 0 };
      }
      protected onDispose() {
        onDispose();
      }
    }

    const { Provider, useVM } = createViewModelContext(LifeVM);

    function View() {
      useVM();
      return null;
    }

    const { unmount } = render(
      <Provider>
        <View />
      </Provider>,
    );
    expect(onDispose).not.toHaveBeenCalled();

    unmount();
    expect(onDispose).toHaveBeenCalledOnce();
  });
});
