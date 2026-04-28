# 生命周期

<script setup>
import Theme from '../demos/theme';
import ThemeVMSrc from '../demos/theme/vm.ts?raw';
import ThemeSrc from '../demos/theme/index.tsx?raw';
</script>

ViewModel 有四个生命周期钩子,按需重写即可。所有钩子默认空实现,不需要 `super.xxx()`。

## 钩子全景

| 钩子 | 触发时机 | 典型用途 |
|---|---|---|
| `onInit` | 实例构造时(同步) | 同步初始化、读 localStorage |
| `onMount` | View 挂载时 | 启动副作用、定时器、订阅、首次拉数据 |
| `onUnmount` | View 卸载时 | 清理副作用、定时器 |
| `onDispose` | `$dispose()` 时(自动或手动) | 终态清理、释放重资源 |

::: tip Vue 风格:卸载即销毁
`useViewModel` / `Provider` 在组件卸载时**自动销毁 VM** —— VM 与组件同生命周期(Vue:unmount === destroy)。

执行顺序:`onUnmount`(若挂载中) → 标记 disposed → `onDispose` → drain effect scope。`$subscribe` / `$watch` / `$onCleanup` 注册的清理**全部自动执行**,业务代码不需要在 `onUnmount` 里手动 unsub。

外部直接 `new VM()` 的场景(测试、Node 脚本)需要显式调 `dispose(vm)`(从 `bizify` / `bizify/core` 导入)。
:::

::: tip StrictMode 在 bizify 里是隐形的
React 18 dev 模式下 `useEffect` 会被故意 **mount → cleanup → mount** 跑一遍,但 bizify 用微任务级延迟协调把这层"漏水"补上了——**`onMount` / `onUnmount` / `onDispose` 永远只在真实进入/离开页面时各触发一次**,语义和 Vue 完全一致。

你不需要为 StrictMode 写 idempotent,也不用担心 `fetchUser` 双发——按 Vue 的直觉写就行。
:::

## 触发时序

```
new VM()
  └─ onInit()                ← 立即同步触发

[Provider 或 useViewModel 真正挂载]
  └─ (微任务后) onMount()    ← StrictMode 双跑被合并

[组件卸载]
  └─ (微任务后) dispose(vm)
       ├─ onUnmount()        ← 仍挂载中所以先调
       ├─ onDispose()
       └─ drain effect scope ← $subscribe/$watch/$onCleanup 全部清理
```

::: tip 微任务延迟意味着什么
`onMount` / `onUnmount` 不在 effect 同步阶段触发,而是延后一个微任务(`queueMicrotask`)。
对业务代码**完全无感知**——网络请求、定时器、事件监听都还没开始,推迟一个微任务再启动毫无影响。
但写测试时,`render(...)` 之后要 `await Promise.resolve()` 才能断言 `onMount` 已经触发。
:::

## 实战:轮询

`$onCleanup(fn)` 把任意清理函数登记到 effect scope,卸载时自动执行 —— 不需要把 timer / handler 存到字段里:

```ts
class StatsVM extends ViewModelBase<{ data: Stats | null }> {
  protected $data() { return { data: null }; }

  protected onMount() {
    this.fetch();
    const id = setInterval(this.fetch, 5000);
    this.$onCleanup(() => clearInterval(id));
  }

  fetch = async () => {
    if (this.$disposed) return;
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
    const onResize = () => {
      this.data.width = window.innerWidth;
      this.data.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    this.$onCleanup(() => window.removeEventListener('resize', onResize));
  }
}
```

## 实战:持久化

切换主题,刷新页面看 `onInit` 是否从 localStorage 恢复:

<ReactDemo :component="Theme" :vm-source="ThemeVMSrc" :component-source="ThemeSrc" />

## 实战:浏览器可见性(节能)

```ts
class StatsVM extends ViewModelBase<{ data: Stats | null }> {
  protected $data() { return { data: null }; }

  private timer?: ReturnType<typeof setInterval>;

  protected onMount() {
    this.startPolling();
    const onVisibility = () =>
      document.hidden ? this.stopPolling() : this.startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    this.$onCleanup(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.stopPolling();
    });
  }

  private startPolling = () => {
    this.fetch();
    this.timer = setInterval(this.fetch, 5000);
  };

  private stopPolling = () => clearInterval(this.timer);

  fetch = async () => {
    if (this.$disposed) return;
    this.data.data = await api.getStats();
  };
}
```

## `$disposed`:async action 守卫

异步方法在 await 之后,VM 可能已被卸载销毁。用 `this.$disposed` 提前返回,避免写入孤儿 proxy:

```ts
async fetchTodos() {
  const data = await api.getTodos();
  if (this.$disposed) return;     // 卸载后直接退出
  this.data.todos = data;
}
```

## 手动销毁 VM:`dispose(vm)`

如果你在不通过 `useViewModel` / Provider 的场景下创建了 VM(测试、Node 脚本),记得显式销毁:

```ts
import { dispose } from 'bizify';   // 或 'bizify/core'
import { MyVM } from './my-vm';

const vm = new MyVM();
// ...用 vm 跑业务逻辑
dispose(vm);   // 触发 onUnmount(若手动 mount 过) + onDispose + drain effect scope
```

`dispose(vm)` 是**幂等**的,多次调用安全。React 路径下框架自动调,业务代码不需要管。

::: tip 为什么不是 vm.$dispose()
`$dispose` / `$disposed` 是 **protected** —— view 层 `vm.` 自动补全里看不到,避免误用。class 内部用 `this.$disposed` 守卫;class 外部一律走模块级 `dispose(vm)` / `isDisposed(vm)`。
:::
