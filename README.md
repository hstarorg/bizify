# Bizify

> 轻量的 React MVVM 框架。把业务逻辑写在 ViewModel 里,视图只负责渲染。基于 [valtio](https://github.com/pmndrs/valtio) 实现,自动追踪 + 直接 mutate。

[![npm](https://img.shields.io/npm/v/bizify.svg)](https://www.npmjs.com/package/bizify)
[![license](https://img.shields.io/npm/l/bizify.svg)](./LICENSE)

## 安装

```bash
pnpm add bizify
```

## 快速开始

```ts
// counter-vm.ts
import { ViewModelBase } from 'bizify';

export class CounterVM extends ViewModelBase<{ count: number }> {
  protected $data() {
    return { count: 0 };
  }

  plus() {
    this.data.count += 1;
  }
  minus() {
    this.data.count -= 1;
  }
}
```

```tsx
// Counter.tsx
import { useViewModel } from 'bizify';
import { CounterVM } from './counter-vm';

export function Counter() {
  const vm = useViewModel(CounterVM);
  const snap = vm.useSnapshot();

  return (
    <div>
      <button onClick={vm.minus}>-</button>
      <span>{snap.count}</span>
      <button onClick={vm.plus}>+</button>
    </div>
  );
}
```

## 核心特性

- **MVVM 架构** — VM 持有状态与行为,View 只关心渲染
- **直接 mutate** — 基于 valtio,`this.data.x = y` 自动响应,深度嵌套也行
- **自动追踪订阅** — `vm.useSnapshot()` 读什么订什么,无需 selector / shallow
- **计算属性** — 在 `$data` 里写 getter,自动追踪依赖
- **生命周期** — `onInit` / `onMount` / `onUnmount`,**StrictMode 隐形**(单触发,Vue 风格)
- **SSR 友好** — Provider 模式,跨请求隔离,初始数据可注入
- **类风格 OOP** — 业务逻辑可独立单测,无需 mock React

## API 概览

```ts
import {
  ViewModelBase,            // 基类
  useViewModel,             // 组件局部 VM
  createViewModelContext,   // Provider + 共享 / SSR
} from 'bizify';

// 框架无关核心
import { ViewModelBase } from 'bizify/core';
```

## 文档

完整文档:<https://hstarorg.github.io/bizify/>

- [介绍](https://hstarorg.github.io/bizify/guide/)
- [快速开始](https://hstarorg.github.io/bizify/guide/getting-started)
- [ViewModel 基础](https://hstarorg.github.io/bizify/guide/viewmodel)
- [订阅与派生](https://hstarorg.github.io/bizify/guide/subscription)
- [生命周期](https://hstarorg.github.io/bizify/guide/lifecycle)
- [Provider 与 SSR](https://hstarorg.github.io/bizify/guide/provider)

## 开发

```bash
pnpm install        # 装依赖
pnpm test           # 跑测试
pnpm build          # 构建库
pnpm docs:dev       # 文档站本地预览
pnpm docs:build     # 构建文档站
pnpm lint           # oxlint
```

## License

MIT © [hstarorg](https://github.com/hstarorg)
