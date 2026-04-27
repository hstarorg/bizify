import { ViewModelBase } from 'bizify';

export type Mode = 'light' | 'dark';

const STORAGE_KEY = 'bizify-demo-theme';

export class ThemeVM extends ViewModelBase<{
  mode: Mode;
  lastWritten: string;
}> {
  protected $data() {
    return { mode: 'light' as Mode, lastWritten: '—' };
  }

  protected onInit() {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      this.data.mode = saved;
    }
  }

  protected onMount() {
    // 任何 mode 变化自动写回 localStorage
    this.unsubPersist = this.$watch('mode', (mode) => {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, mode);
      this.data.lastWritten = new Date().toLocaleTimeString();
    });
  }

  protected onUnmount() {
    this.unsubPersist?.();
  }

  private unsubPersist?: () => void;

  toggle() {
    this.data.mode = this.data.mode === 'light' ? 'dark' : 'light';
  }
}
