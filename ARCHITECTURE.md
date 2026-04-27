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
│   │   ├── ViewModelBase.ts   继承 core,加 use() hook
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
| Core | `src/core/ViewModelBase.ts` | valtio proxy 状态、生命周期钩子、`$subscribe` / `$watch`、`autoBindPrototypeMethods`、`dispose` |
| React | `src/react/ViewModelBase.ts` | 加一个 `use()`(调 `useSnapshot`,cast 回 `T` 脱 readonly) |

子类继承 React 版本(默认入口)或 Core 版本(`bizify/core`,框架无关场景)。

## 关键不变量

### 1. 状态 mutable,snapshot readonly

- `vm.data.x = y` 直接 mutate,valtio 自动派发
- `vm.use()` 返回 snapshot——运行时 readonly(写入抛错),TS 类型脱回 `T`(便于和子组件 props 组合)
- 约定:**修改走 `vm.data`,读取走 `vm.use()`**

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

`autoBindPrototypeMethods`:沿原型链(到 `Object.prototype` 之前)把每个非 constructor、非 getter/setter、非 own 的方法 `bind(this)` 后写为不可枚举 own property。

效果:箭头字段和原型方法都能直接当事件处理器传,`const { plus } = vm; plus()` 不丢 `this`。基类方法(`dispose` / `$subscribe`)同样被绑定。

### 4. 生命周期 StrictMode 隐形

`lifecycleBinding`(`src/react/lifecycleBinding.ts`)用"期望状态 + 微任务协调"模式:

- effect mount → desired=true,scheduleMicrotask
- effect cleanup → desired=false,scheduleMicrotask
- 微任务执行时只看最终 desired,只调用一次 `__mount` 或 `__unmount`

结果:**StrictMode 双跑、并发模式弃用提交、Suspense 重挂载,全部合并为单次 `onMount`/`onUnmount`**——业务代码不需要写 idempotent。

### 5. `dispose()` 不自动触发

`useViewModel` 和 `Provider` 的 effect cleanup 只调 `__unmount`,**不调 `dispose`**。理由是 StrictMode 安全:cleanup → mount 循环不能销毁实例。

`onDispose` 仅在用户显式 `vm.dispose()` 时触发,留给容器/注册表/测试 teardown 场景。

### 6. 引用计数

`__mount` / `__unmount` 内部维护 `mountCount`,只在 `0→1` / `1→0` 时触发 `onMount` / `onUnmount`。多个 binding 共享同一 VM 时(理论场景,实际很少触发)只触发一次生命周期。

## 视图绑定

| API | 用途 | 实例归属 |
|---|---|---|
| `useViewModel(Ctor)` | 组件局部 VM | `useState(() => new Ctor())`,跟组件生命周期 |
| `createViewModelContext(Ctor)` | 共享 / SSR | Provider 持有,`initial` prop 注入,**只读一次** |

两者都用 `lifecycleBinding`,所以 StrictMode 行为一致。

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
  - `test/core.test.ts` — 类语义(state、$subscribe、$watch、生命周期、dispose、autoBind、computed via getter)
  - `test/useViewModel.test.tsx` — React 集成(挂载、自动追踪、嵌套 mutation、StrictMode、原型方法事件处理器)
  - `test/createViewModelContext.test.tsx` — Provider 共享、initial 注入、initial 只读一次、StrictMode、生命周期

valtio `subscribe` / `subscribeKey` 是异步的(微任务),测试断言副作用前要 `await Promise.resolve()`。

## 决策记录

历次设计权衡的细节在 conversation history,无需重复。改动架构时更新本文件并附简短理由。
