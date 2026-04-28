# Bizify 架构设计

> 本文是项目内部的设计参考。修改架构时更新这里,**不要往 CLAUDE.md 塞细节**。

## 定位

React MVVM 框架,业务逻辑写在 ViewModel 类里,视图只负责渲染。底层 [valtio](https://valtio.dev) 提供响应式 + 自动追踪。

## 整体结构

```
bizify/
├── src/
│   ├── core/                  框架无关层(可在 Node / Vue / Solid 复用)
│   │   ├── ViewModelBase.ts   类:state proxy + 生命周期 + autoBind
│   │   └── index.ts
│   ├── react/                 React 绑定层
│   │   ├── ViewModelBase.ts   继承 core,加 useSnapshot() hook
│   │   ├── useViewModel.ts    组件局部 VM hook
│   │   ├── createViewModelContext.ts  Provider + useVM
│   │   ├── lifecycleBinding.ts        微任务级生命周期协调器
│   │   └── index.ts
│   ├── internal/dev.ts        共享 isDev 守卫
│   └── index.ts               re-export react/
├── test/                      Vitest + jsdom + RTL
└── docs/                      VitePress 站(用户文档)
```

## 核心抽象:ViewModelBase

唯一的核心抽象。两层继承:

| 层 | 文件 | 职责 |
|---|---|---|
| Core | `src/core/ViewModelBase.ts` | valtio proxy 状态、生命周期钩子、effect scope(`$subscribe` / `$watch` / `$onCleanup` / `$disposed` / `$dispose`)、`autoBindMethods` |
| React | `src/react/ViewModelBase.ts` | 加一个 `useSnapshot()`(内部调 valtio `useSnapshot`,cast 回 `T` 脱 readonly) |

子类继承 React 版本(默认入口)或 Core 版本(`bizify/core`,框架无关场景)。

## 关键不变量

### 1. 状态 mutable,snapshot readonly,公开作用域受限

- `this.data.x = y` 在 VM 方法内直接 mutate,valtio 自动派发
- `data` 是 **protected**,view 拿不到——强制 view 走 `useSnapshot()`,避免绕过封装直接改状态
- `vm.useSnapshot()` 返回 snapshot——运行时 readonly(写入抛错),TS 类型脱回 `T`(便于和子组件 props 组合)
- `$subscribe` / `$watch` / `$onCleanup` / `$data` 全是 **protected**,典型用法是 VM 在 `onMount` 里订阅自身。外部需要订阅时,在 VM 上暴露一个具体的 `onXxxChange(cb)` public 方法包一层
- view 端 `vm.` 自动补全只看到:`useSnapshot()` / 子类自定义方法。`$dispose` / `$disposed` 都是 protected,外部销毁/查询走模块级 `dispose(vm)` / `isDisposed(vm)`

### 2. 计算属性 = `$data()` 的 getter

```ts
$data(): CartState {
  return {
    items: [],
    discount: 0,
    get total() {
      return this.items.reduce(...) * (1 - this.discount);
    },
  };
}
```

- getter 内 `this` 是 state 对象自身(TS 自动推导)
- valtio snapshot 把它当响应式属性,自动追踪 `items` / `discount`
- `vm.data.total` 和 `snap.total` 行为一致
- **构造函数必须用 `Object.getOwnPropertyDescriptors` + `Object.defineProperties` 保留 getter**;直接 `{...$data()}` 会把 getter 平展成静态值

### 3. `this` 自动绑定

`autoBindMethods`:沿原型链(到 `Object.prototype` 之前)把每个**非 constructor、非 `$`-prefix、非 getter/setter、非 own** 的方法 `bind(this)` 后写为不可枚举 own property。

效果:用户的箭头字段和原型方法都能直接当事件处理器传,`const { plus } = vm; plus()` 不丢 `this`。**框架方法(`$dispose` / `$subscribe` / `$watch` / `$onCleanup`)不 bind** —— 它们通过 `vm.method()` 调用,不需要 destructure-safety;且不进实例 own keys,减少污染。

### 4. 生命周期 StrictMode 隐形

`lifecycleBinding`(`src/react/lifecycleBinding.ts`)用"期望状态 + 微任务协调"模式:

- effect mount → desired=true,scheduleMicrotask
- effect cleanup → desired=false,scheduleMicrotask
- 微任务执行时只看最终 desired,只调用一次 `[VM_MOUNT]` 或 `[VM_UNMOUNT]`

结果:**StrictMode 双跑、并发模式弃用提交、Suspense 重挂载,全部合并为单次 `onMount`/`onUnmount`**——业务代码不需要写 idempotent。

### 5. 单一 effect scope,卸载即销毁(Vue-style)

VM 维护**一个** cleanup 列表(模块级 `WeakMap` 里的 `cleanups: Array<() => void>`),**所有** `$subscribe` / `$watch` / `$onCleanup` 注册都进同一个 scope —— 对齐 Vue 3 的 `effectScope` 心智。

销毁路径(`$dispose`):

1. 若 `mountCount > 0`,先 `onUnmount`、`mountCount` 清零
2. 标记 `disposed = true`
3. 调 `onDispose`
4. drain `cleanups`(LIFO,异常隔离 —— 一个 cleanup 抛错不阻塞后续)

React 路径下,`useViewModel` / `Provider` 的 effect cleanup **调 `dispose(vm)`** —— VM 与组件同生命周期(Vue:unmount === destroy)。`lifecycleBinding` 微任务协调器保证 StrictMode 的 mount → cleanup → mount 不会触发销毁。

外部直接 `new VM()` 的场景(测试 teardown、手动注册表场景)用模块级 `dispose(vm)` 销毁、`isDisposed(vm)` 查询状态。`$dispose` / `$disposed` 是 protected —— class 内部用 `this.$disposed` 守卫即可:

```ts
async fetchTodos() {
  const data = await api.get();
  if (this.$disposed) return;
  this.data.todos = data;
}
```

### 6. WeakMap 内部状态 + 结构化 cast

整个 per-VM 状态(`mountCount` / `disposed` / `cleanups`)塞在模块级 `WeakMap<vm, VMState>` 里,**实例上没有任何框架内部字段** —— `Object.getOwnPropertyNames(vm)` / `Object.getOwnPropertySymbols(vm)` 都看不到。

为什么不用 JS `#` 私有字段:`#field` 在 VS Code 用户视角不可见,但在 DevTools / 反射 API 里仍可见;WeakMap 方案彻底隔离。

框架对外只暴露两个内部函数:`_vmMount(vm)` / `_vmUnmount(vm)`,它们查 WeakMap、走结构化 cast 调用 protected 钩子。这俩函数**故意不从 `bizify/core` 公开导出** —— 只有 `lifecycleBinding.ts` 从源文件直接 import。

**结构化 cast 收敛**:模块级 `invokeOnMount(vm)` / `invokeOnUnmount(vm)` / `callData(vm)` 三个 helper,每个独占一个结构类型(如 `{ onMount(): void }`),把 `as unknown as ...` 的 cast 收到一处。call site 全部干净。

## 视图绑定

| API | 用途 | 实例归属 |
|---|---|---|
| `useViewModel(Ctor)` | 组件局部 VM | 跟组件生命周期,unmount 时自动 `dispose(vm)` |
| `createViewModelContext(Ctor)` | 共享 / SSR | Provider 持有,`initial` prop 注入(**只读一次**),Provider unmount 时自动 `dispose(vm)` |

两者都用 `lifecycleBinding`,所以 StrictMode 行为一致。类型上单类型参数 `<VM extends ViewModelBase<any>>`,内部用 `StateOf<VM>` 反推 state 类型 —— 用户调用不需要补类型参数。

## 构建管线

- **Rolldown** 打 JS:两个 entry(`src/index.ts` → `dist/index.{js,cjs}`,`src/core/index.ts` → `dist/core.{js,cjs}`),`react` / `valtio` 系列全 external,共享代码进 `dist/chunks/`
- **tsc** (`tsconfig.build.json`) 仅产 `.d.ts` 到 `dist/types/`,镜像源码结构
- `package.json` `exports` 字段映射 `.` 和 `./core` 到对应文件
- `pnpm clean` 在 build 前清 `dist/`,避免旧 hash 累积

## 测试架构

- **Vitest** + jsdom + `@testing-library/react`
- `test/setup.ts` 加 jest-dom 匹配器 + 自动 cleanup
- 显式 import(`import { describe } from 'vitest'`),不用 globals
- 三个文件:
  - `test/core.test.ts` — 类语义(state、`$subscribe`、`$watch` 双形式 + immediate、`$onCleanup`、生命周期、`$dispose` 顺序、`$disposed`、autoBind、computed via getter、initial 不覆盖 getter)
  - `test/useViewModel.test.tsx` — React 集成(挂载、自动追踪、嵌套 mutation、StrictMode、原型方法事件处理器、unmount 触发 onDispose)
  - `test/createViewModelContext.test.tsx` — Provider 共享、initial 注入、initial 只读一次、StrictMode、Provider unmount 触发 onDispose

valtio `subscribe` / `subscribeKey` 是异步的(微任务),测试断言副作用前要 `await Promise.resolve()`。

## 决策记录

历次设计权衡的细节在 conversation history,无需重复。改动架构时更新本文件并附简短理由。
