import { ViewModelBase, useViewModel } from 'bizify';

interface CounterState {
  count: number;
}

class CounterVM extends ViewModelBase<CounterState> {
  protected $data(): CounterState {
    return { count: 0 };
  }

  plus() {
    this.data.count += 1;
  }

  minus() {
    this.data.count -= 1;
  }

  reset() {
    this.data.count = 0;
  }
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 18,
  } as const,
  count: {
    minWidth: 48,
    textAlign: 'center' as const,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  button: {
    padding: '6px 14px',
    border: '1px solid var(--vp-c-divider, #e2e2e3)',
    borderRadius: 6,
    background: 'var(--vp-c-bg, #fff)',
    color: 'var(--vp-c-text-1, inherit)',
    fontSize: 16,
  },
};

export default function Counter() {
  const vm = useViewModel(CounterVM);
  const snap = vm.useSnapshot();

  return (
    <div style={styles.wrap}>
      <button style={styles.button} onClick={vm.minus}>
        −
      </button>
      <span style={styles.count}>{snap.count}</span>
      <button style={styles.button} onClick={vm.plus}>
        +
      </button>
      <button style={{ ...styles.button, marginLeft: 12 }} onClick={vm.reset}>
        重置
      </button>
    </div>
  );
}
