# 生命周期

ViewModel 有四个生命周期钩子,按需重写即可。所有钩子默认空实现,不需要 `super.xxx()`。

## 钩子全景

| 钩子 | 触发时机 | 典型用途 |
|---|---|---|
| `onInit` | 实例构造时(同步) | 同步初始化、读 localStorage |
| `onMount` | 第一个 View 挂载时 | 启动副作用、定时器、订阅、首次拉数据 |
| `onUnmount` | 最后一个 View 卸载时 | 清理副作用、定时器 |
| `onDispose` | 实例彻底销毁时 | 回收资源、释放引用 |

::: tip
`onMount` / `onUnmount` 走**引用计数**——多个组件共享同一个 VM 时,只在第一个挂载/最后一个卸载时触发一次。
:::

## 触发时序

```
new VM()
  └─ onInit()                ← 立即同步触发

[Provider 或 useViewModel 挂载]
  └─ onMount()               ← 首次挂载触发(ref count 0 → 1)

[更多组件订阅同一 VM]
  └─ (不再触发 onMount)      ← ref count 1 → 2 → 3...

[逐个组件卸载]
  └─ (不触发 onUnmount)      ← ref count 3 → 2 → 1

[最后一个组件卸载]
  └─ onUnmount()             ← ref count 1 → 0
  └─ onDispose()             ← Provider/useViewModel 同时调用 dispose()
```

## 实战:轮询

```ts
class StatsVM extends ViewModelBase<{ data: Stats | null }> {
  protected $data() { return { data: null }; }

  private timer?: ReturnType<typeof setInterval>;

  protected onMount() {
    this.fetch();
    this.timer = setInterval(this.fetch, 5000);
  }

  protected onUnmount() {
    clearInterval(this.timer);
  }

  fetch = async () => {
    const data = await api.getStats();
    this.$set({ data });
  };
}
```

## 实战:订阅外部事件

```ts
class WindowSizeVM extends ViewModelBase<{ width: number; height: number }> {
  protected $data() {
    return {
      width: typeof window !== 'undefined' ? window.innerWidth : 0,
      height: typeof window !== 'undefined' ? window.innerHeight : 0,
    };
  }

  protected onMount() {
    window.addEventListener('resize', this.onResize);
  }

  protected onUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.$set({ width: window.innerWidth, height: window.innerHeight });
  };
}
```

## 实战:持久化

```ts
class ThemeVM extends ViewModelBase<{ mode: 'light' | 'dark' }> {
  protected $data() { return { mode: 'light' as const }; }

  protected onInit() {
    // 启动时从 localStorage 恢复
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      this.$set({ mode: saved });
    }
  }

  protected onMount() {
    // 自身变化时写回
    this.unsubPersist = this.$subscribe((s) => {
      localStorage.setItem('theme', s.mode);
    });
  }

  protected onUnmount() {
    this.unsubPersist?.();
  }

  private unsubPersist?: () => void;

  toggle = () =>
    this.$set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' }));
}
```

## 实战:浏览器可见性(节能)

```ts
class StatsVM extends ViewModelBase<{ data: Stats | null }> {
  protected $data() { return { data: null }; }

  private timer?: ReturnType<typeof setInterval>;

  protected onMount() {
    this.startPolling();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  protected onUnmount() {
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = () => {
    document.hidden ? this.stopPolling() : this.startPolling();
  };

  private startPolling = () => {
    this.fetch();
    this.timer = setInterval(this.fetch, 5000);
  };

  private stopPolling = () => clearInterval(this.timer);

  fetch = async () => {
    this.$set({ data: await api.getStats() });
  };
}
```

## 手动调用 `dispose()`

如果你在不通过 `useViewModel` / Provider 的场景下创建了 VM(测试、Node 脚本),记得手动 `dispose()`:

```ts
const vm = new MyVM();
vm.__mount();    // 模拟挂载,触发 onMount
// ...用 vm
vm.__unmount();  // 模拟卸载,触发 onUnmount
vm.dispose();    // 触发 onDispose
```

`dispose()` 是**幂等**的,多次调用安全。
