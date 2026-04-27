import { ViewModelBase } from 'bizify';

export interface Item {
  id: string;
  name: string;
  price: number;
}

export type CartState = {
  items: Item[];
  discount: number;
  // computed
  readonly subtotal: number;
  readonly total: number;
  readonly isEmpty: boolean;
};

export class CartVM extends ViewModelBase<CartState> {
  protected $data(): CartState {
    return {
      items: [],
      discount: 0,

      get subtotal() {
        return this.items.reduce((s, i) => s + i.price, 0);
      },

      get total() {
        return Math.round(this.subtotal * (1 - this.discount) * 100) / 100;
      },

      get isEmpty() {
        return this.items.length === 0;
      },
    };
  }

  add(item: Item) {
    this.data.items.push(item);
  }

  remove(idx: number) {
    this.data.items.splice(idx, 1);
  }

  setDiscount(d: number) {
    this.data.discount = d;
  }
}
