import { useViewModel } from 'bizify';
import { TodoVM, type Filter } from './vm';

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 } as const,
  inputRow: { display: 'flex', gap: 8 } as const,
  input: {
    flex: 1,
    padding: '6px 10px',
    border: '1px solid var(--vp-c-divider, #e2e2e3)',
    borderRadius: 6,
    background: 'var(--vp-c-bg, #fff)',
    color: 'var(--vp-c-text-1, inherit)',
  },
  button: {
    padding: '6px 14px',
    border: '1px solid var(--vp-c-divider, #e2e2e3)',
    borderRadius: 6,
    background: 'var(--vp-c-bg, #fff)',
    color: 'var(--vp-c-text-1, inherit)',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as const,
  item: { display: 'flex', alignItems: 'center', gap: 8 } as const,
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    color: 'var(--vp-c-text-2)',
  } as const,
  filters: { display: 'flex', gap: 6 } as const,
};

const filterLabel: Record<Filter, string> = {
  all: '全部',
  active: '未完成',
  done: '已完成',
};

export default function Todo() {
  const vm = useViewModel(TodoVM);
  const snap = vm.useSnapshot();

  return (
    <div style={styles.wrap}>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={snap.draft}
          placeholder="加一个待办..."
          onChange={(e) => vm.setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && vm.add()}
        />
        <button style={styles.button} onClick={vm.add}>
          添加
        </button>
      </div>

      <ul style={styles.list}>
        {snap.visibleItems.map((t) => (
          <li key={t.id} style={styles.item}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => vm.toggle(t.id)}
            />
            <span
              style={{
                flex: 1,
                textDecoration: t.done ? 'line-through' : 'none',
                color: t.done ? 'var(--vp-c-text-3)' : 'var(--vp-c-text-1)',
              }}
            >
              {t.text}
            </span>
            <button style={styles.button} onClick={() => vm.remove(t.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>

      <div style={styles.meta}>
        <span>{snap.remaining} 项未完成</span>
        <div style={styles.filters}>
          {(['all', 'active', 'done'] as Filter[]).map((f) => (
            <button
              key={f}
              style={{
                ...styles.button,
                fontWeight: snap.filter === f ? 600 : 400,
                borderColor:
                  snap.filter === f
                    ? 'var(--vp-c-brand-1, #3451b2)'
                    : undefined,
              }}
              onClick={() => vm.setFilter(f)}
            >
              {filterLabel[f]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
