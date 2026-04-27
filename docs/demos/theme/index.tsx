import { useViewModel } from 'bizify';
import { ThemeVM } from './vm';

const palette = {
  light: { bg: '#fafafa', fg: '#1a1a1a', accent: '#3451b2' },
  dark: { bg: '#1a1a1a', fg: '#f0f0f0', accent: '#a8b1ff' },
};

export default function Theme() {
  const vm = useViewModel(ThemeVM);
  const snap = vm.useSnapshot();
  const c = palette[snap.mode];

  return (
    <div
      style={{
        background: c.bg,
        color: c.fg,
        padding: 20,
        borderRadius: 8,
        transition: 'background 0.2s, color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600 }}>当前主题:{snap.mode}</div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        最后写入 localStorage:<code>{snap.lastWritten}</code>
      </div>
      <button
        onClick={vm.toggle}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 16px',
          border: `1px solid ${c.accent}`,
          borderRadius: 6,
          background: c.accent,
          color: c.bg,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        切换 → {snap.mode === 'light' ? 'dark' : 'light'}
      </button>
      <div style={{ fontSize: 12, opacity: 0.6 }}>
        刷新页面看 onInit 是否从 localStorage 恢复了主题。
      </div>
    </div>
  );
}
