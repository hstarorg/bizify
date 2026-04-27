# 快速开始

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

  plus = () => this.$set({ count: this.data.count + 1 });
  minus = () => this.$set({ count: this.data.count - 1 });
  reset = () => this.$set({ count: 0 });
}
```

::: tip
方法用**箭头函数类字段**(`plus = () => ...`),`this` 自动绑定,可以直接当事件处理器传给 JSX。
:::

### 2. 在组件中绑定

```tsx
// Counter.tsx
import { useViewModel } from 'bizify';
import { CounterVM } from './counter-vm';

export function Counter() {
  const vm = useViewModel(CounterVM);
  const count = vm.use((s) => s.count);

  return (
    <div>
      <h1>{count}</h1>
      <button onClick={vm.minus}>-</button>
      <button onClick={vm.reset}>reset</button>
      <button onClick={vm.plus}>+</button>
    </div>
  );
}
```

### 3. 完事

`useViewModel` 自动负责:
- 组件首次渲染时 `new CounterVM()`
- 订阅 VM 的状态变化,自动重渲染
- 组件卸载时 `dispose()`

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
    expect(vm['data'].count).toBe(2);
  });
});
```

## 接下来

- [ViewModel 基础](/guide/viewmodel):`$data` / `$set` / 异步方法
- [订阅与派生](/guide/subscription):selector、shallow、`useDerived`
- [生命周期](/guide/lifecycle):`onMount` / `onUnmount` 实战
- [Provider 与 SSR](/guide/provider):跨组件共享、SSR 数据注入
