import { CartProvider, useCart, type Item } from './vm';

const CATALOG: Item[] = [
  { id: 'a', name: '苹果', price: 5 },
  { id: 'b', name: '香蕉', price: 3 },
];

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 } as const,
  card: {
    border: '1px solid var(--vp-c-divider, #e2e2e3)',
    borderRadius: 6,
    padding: 12,
    background: 'var(--vp-c-bg, #fff)',
  } as const,
  cardTitle: {
    fontSize: 12,
    color: 'var(--vp-c-text-3)',
    marginBottom: 6,
  } as const,
  row: { display: 'flex', alignItems: 'center', gap: 8 } as const,
  pill: {
    padding: '4px 10px',
    border: '1px solid var(--vp-c-divider, #e2e2e3)',
    borderRadius: 999,
    background: 'var(--vp-c-bg, #fff)',
    cursor: 'pointer',
  },
  badge: {
    background: 'var(--vp-c-brand-1, #3451b2)',
    color: '#fff',
    borderRadius: 999,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
};

function Header() {
  const cart = useCart();
  const snap = cart.useSnapshot();
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Header(订阅 count)</div>
      <div style={styles.row}>
        <span>购物车</span>
        <span style={styles.badge}>{snap.count}</span>
      </div>
    </div>
  );
}

function Footer() {
  const cart = useCart();
  const snap = cart.useSnapshot();
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Footer(订阅 subtotal)</div>
      <div>合计:¥{snap.subtotal}</div>
    </div>
  );
}

function Picker() {
  const cart = useCart();
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Picker(只调 add,不订阅)</div>
      <div style={styles.row}>
        {CATALOG.map((item) => (
          <button
            key={item.id}
            style={styles.pill}
            onClick={() => cart.add(item)}
          >
            + {item.name} ¥{item.price}
          </button>
        ))}
        <button style={styles.pill} onClick={() => cart.clear()}>
          清空
        </button>
      </div>
    </div>
  );
}

export default function SharedCart() {
  return (
    <CartProvider>
      <div style={styles.wrap}>
        <Header />
        <Picker />
        <Footer />
      </div>
    </CartProvider>
  );
}
