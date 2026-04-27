# 快速开始

<script setup>
import Counter from '../demos/counter';
import CounterVMSrc from '../demos/counter/vm.ts?raw';
import CounterSrc from '../demos/counter/index.tsx?raw';
</script>

下面是我们要做的东西——一个最朴素的计数器:

<ReactDemo :component="Counter" :vm-source="CounterVMSrc" :component-source="CounterSrc" />

## 安装

::: code-group
```bash [pnpm]
pnpm add bizify
```

```bash [npm]
npm install bizify
```

```bash [yarn]
yarn add bizify
```
:::

## 三步上手

### 1. 定义 ViewModel

```ts
// counter-vm.ts
import { ViewModelBase } from 'bizify';

interface CounterState {
  count: number;
}

export class CounterVM extends ViewModelBase<CounterState> {
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
```

::: tip 直接 mutate 就行
bizify 底层是 valtio,所以 `this.data.x = y` / `this.data.list.push(x)` / `this.data.user.profile.name = 'X'` 都直接生效——不用 `$set`、不用 spread、不用 immer。

方法既可以写成原型方法(如上),也可以写成箭头字段(`plus = () => { ... }`)。**两者都自动绑定 `this`**,可以直接当事件处理器传给 JSX。
:::

### 2. 在组件中绑定

```tsx
// Counter.tsx
import { useViewModel } from 'bizify';
import { CounterVM } from './counter-vm';

export function Counter() {
  const vm = useViewModel(CounterVM);
  const snap = vm.useSnapshot();   // 自动追踪读到的字段

  return (
    <div>
      <h1>{snap.count}</h1>
      <button onClick={vm.minus}>-</button>
      <button onClick={vm.reset}>reset</button>
      <button onClick={vm.plus}>+</button>
    </div>
  );
}
```

### 3. 完事

`useViewModel` 自动负责:
- 组件首次渲染时 `new CounterVM()`(`onInit` 触发)
- 视图挂载后触发 `onMount`,卸载时触发 `onUnmount`(StrictMode 双跑被合并)
- `useSnapshot()` 自动追踪在 render 中读到的字段,变化时重渲染

## 单测 ViewModel

VM 是普通类,可以脱离 React 单测:

```ts
import { describe, it, expect } from 'vitest';
import { CounterVM } from './counter-vm';

describe('CounterVM', () => {
  it('plus increments count', () => {
    const vm = new CounterVM();
    vm.plus();
    vm.plus();
    expect(vm.data.count).toBe(2);
  });
});
```

## 接下来

- [ViewModel 基础](/guide/viewmodel):`$data` / 直接 mutate / 计算属性
- [订阅与派生](/guide/subscription):自动追踪、`$watch`、命令式订阅
- [生命周期](/guide/lifecycle):`onMount` / `onUnmount` 实战
- [Provider 与 SSR](/guide/provider):跨组件共享、SSR 数据注入
