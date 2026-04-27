# 生命周期

<script setup>
import Theme from '../demos/Theme.tsx';
</script>

ViewModel 有四个生命周期钩子,按需重写即可。所有钩子默认空实现,不需要 `super.xxx()`。

## 钩子全景

| 钩子 | 触发时机 | 典型用途 |
|---|---|---|
| `onInit` | 实例构造时(同步) | 同步初始化、读 localStorage |
| `onMount` | 第一个 View 挂载时 | 启动副作用、定时器、订阅、首次拉数据 |
| `onUnmount` | 最后一个 View 卸载时 | 清理副作用、定时器 |
| `onDispose` | **显式**调用 `vm.$dispose()` 时 | 一次性销毁(测试、容器/注册表) |

::: tip
`onMount` / `onUnmount` 走**引用计数**——多个组件共享同一个 VM 时,只在第一个挂载/最后一个卸载时触发一次。
:::

::: tip StrictMode 在 bizify 里是隐形的
React 18 dev 模式下 `useEffect` 会被故意 **mount → cleanup → mount** 跑一遍,但 bizify 用微任务级延迟协调把这层"漏水"补上了——**`onMount` / `onUnmount` 永远只在真实进入/离开页面时各触发一次**,语义和 Vue 的 `onMounted` / `onUnmounted` 完全一致。

你不需要为 StrictMode 写 idempotent,也不用担心 `fetchUser` 双发——按 Vue 的直觉写就行。
:::

## 触发时序

```
new VM()
  └─ onInit()                ← 立即同步触发

[Provider 或 useViewModel 真正挂载]
  └─ (微任务后) onMount()    ← StrictMode 双跑被合并

[更多组件订阅同一 VM]
  └─ (不再触发 onMount)      ← ref count 1 → 2 → 3...

[逐个组件卸载]
  └─ (不触发 onUnmount)      ← ref count 3 → 2 → 1

[最后一个组件真正卸载]
  └─ (微任务后) onUnmount()  ← StrictMode/Suspense 弃用提交也被合并

[显式 vm.$dispose()]
  └─ onDispose()             ← 仅手动调用时触发
```

::: tip 微任务延迟意味着什么
`onMount` 和 `onUnmount` 不在 effect 同步阶段触发,而是延后一个微任务(`queueMicrotask`)。
对业务代码**完全无感知**——网络请求、定时器、事件监听都还没开始,推迟一个微任务再启动毫无影响。
但写测试时,`render(...)` 之后要 `await Promise.resolve()` 才能断言 `onMount` 已经触发。
:::

::: warning onDispose 不再自动触发
之前版本里 `useViewModel` / Provider unmount 时会自动调 `$dispose()`。1.0 起**不再这样**——
StrictMode 的双跑机制会让自动 `$dispose` 错误地销毁实例。**所有视图相关的清理都放在 `onUnmount`**,
`onDispose` 留给显式销毁场景(测试 teardown、容器统一释放等)。
:::

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
    this.data.data = await api.getStats();
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
    this.data.width = window.innerWidth;
    this.data.height = window.innerHeight;
  };
}
```

## 实战:持久化

切换主题,刷新页面看 `onInit` 是否从 localStorage 恢复:

<ReactDemo :component="Theme">

```ts
class ThemeVM extends ViewModelBase<{ mode: 'light' | 'dark' }> {
  protected $data() { return { mode: 'light' as const }; }

  protected onInit() {
    // 启动时从 localStorage 恢复
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      this.data.mode = saved;
    }
  }

  protected onMount() {
    // 自身变化时自动写回
    this.unsubPersist = this.$watch('mode', (mode) => {
      localStorage.setItem('theme', mode);
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
```

</ReactDemo>

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
    this.data.data = await api.getStats();
  };
}
```

## 手动调用 `$dispose()`

如果你在不通过 `useViewModel` / Provider 的场景下创建了 VM(测试、Node 脚本),记得手动 `$dispose()`:

```ts
const vm = new MyVM();
vm.__mount();    // 模拟挂载,触发 onMount
// ...用 vm
vm.__unmount();  // 模拟卸载,触发 onUnmount
vm.$dispose();    // 触发 onDispose
```

`$dispose()` 是**幂等**的,多次调用安全。
