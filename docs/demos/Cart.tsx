import { ViewModelBase, useViewModel } from 'bizify';

interface Item {
  id: string;
  name: string;
  price: number;
}

type CartState = {
  items: Item[];
  discount: number;
  // computed
  readonly subtotal: number;
  readonly total: number;
  readonly isEmpty: boolean;
};

const CATALOG: Item[] = [
  { id: 'a', name: '苹果', price: 5 },
  { id: 'b', name: '香蕉', price: 3 },
  { id: 'c', name: '橙子', price: 6 },
];

class CartVM extends ViewModelBase<CartState> {
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

  clear() {
    this.data.items = [];
    this.data.discount = 0;
  }
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 } as const,
  catalog: { display: 'flex', gap: 8, flexWrap: 'wrap' } as const,
  pill: {
    padding: '6px 12px',
    border: '1px solid var(--vp-c-divider, #e2e2e3)',
    borderRadius: 999,
    background: 'var(--vp-c-bg, #fff)',
    cursor: 'pointer',
  },
  list: { listStyle: 'none', padding: 0, margin: 0 } as const,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid var(--vp-c-divider, #e2e2e3)',
  } as const,
  empty: { padding: '12px', color: 'var(--vp-c-text-3)', textAlign: 'center' as const },
  summary: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 } as const,
  summaryRow: { display: 'flex', justifyContent: 'space-between' } as const,
  total: { fontSize: 18, fontWeight: 700 } as const,
  discountRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } as const,
  remove: {
    background: 'transparent',
    border: 'none',
    color: 'var(--vp-c-text-2)',
    cursor: 'pointer',
  },
};

export default function Cart() {
  const vm = useViewModel(CartVM);
  const snap = vm.useSnapshot();

  return (
    <div style={styles.wrap}>
      <div style={styles.catalog}>
        {CATALOG.map((item) => (
          <button
            key={item.id}
            style={styles.pill}
            onClick={() => vm.add(item)}
          >
            + {item.name} ¥{item.price}
          </button>
        ))}
      </div>

      {snap.isEmpty ? (
        <div style={styles.empty}>购物车是空的</div>
      ) : (
        <ul style={styles.list}>
          {snap.items.map((item, i) => (
            <li key={i} style={styles.row}>
              <span>{item.name}</span>
              <span>
                ¥{item.price}
                <button style={styles.remove} onClick={() => vm.remove(i)}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div style={styles.discountRow}>
        <span>折扣:</span>
        {[0, 0.1, 0.2, 0.3].map((d) => (
          <button
            key={d}
            style={{
              ...styles.pill,
              fontWeight: snap.discount === d ? 600 : 400,
              borderColor: snap.discount === d ? 'var(--vp-c-brand-1, #3451b2)' : undefined,
            }}
            onClick={() => vm.setDiscount(d)}
          >
            {d === 0 ? '原价' : `${d * 100}% off`}
          </button>
        ))}
      </div>

      <div style={styles.summary}>
        <div style={styles.summaryRow}>
          <span>小计</span>
          <span>¥{snap.subtotal}</span>
        </div>
        <div style={styles.summaryRow}>
          <span>折后</span>
          <span style={styles.total}>¥{snap.total}</span>
        </div>
      </div>
    </div>
  );
}
