import { ViewModelBase, createViewModelContext } from 'bizify';

export interface Item {
  id: string;
  name: string;
  price: number;
}

export type CartState = {
  items: Item[];
  // computed
  readonly subtotal: number;
  readonly count: number;
};

export class SharedCartVM extends ViewModelBase<CartState> {
  protected $data(): CartState {
    return {
      items: [],
      get subtotal() {
        return this.items.reduce((s, i) => s + i.price, 0);
      },
      get count() {
        return this.items.length;
      },
    };
  }

  add(item: Item) {
    this.data.items.push(item);
  }

  clear() {
    this.data.items = [];
  }
}

export const { Provider: CartProvider, useVM: useCart } =
  createViewModelContext(SharedCartVM);
