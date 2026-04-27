# 介绍

Bizify 是一个**轻量的 React MVVM 框架**,核心思路是把业务逻辑从组件里抽出来,写成 ViewModel 类。

## 设计理念

传统 React 写法里,状态、副作用、业务规则全都揉在组件函数里——一个稍复杂的页面很快就会出现十几个 `useState` + `useEffect` + 自定义 hook 的拼凑。Bizify 把它们收敛到一个**类**里:

```ts
class CounterVM extends ViewModelBase<{ count: number }> {
  protected $data() {
    return { count: 0 };
  }

  plus() { this.data.count += 1; }
}
```

视图只负责渲染:

```tsx
function Counter() {
  const vm = useViewModel(CounterVM);
  const snap = vm.useSnapshot();
  return <button onClick={vm.plus}>{snap.count}</button>;
}
```

## 三层职责

| 层 | 职责 | 形态 |
|---|---|---|
| **Model** | 状态数据 | `$data()` 返回的对象 |
| **ViewModel** | 状态 + 行为 + 业务逻辑 | 继承 `ViewModelBase` 的类 |
| **View** | 渲染 + 事件转发 | React 组件 + `useViewModel` |

## 它适合什么场景

✅ 中后台、表单密集型应用
✅ 业务规则复杂、需要单测业务逻辑
✅ 团队有 OOP 背景,希望逻辑组织得像类
✅ 想避免 hook 闭包陷阱、依赖数组陷阱

❌ 纯展示页 / 营销页 — 杀鸡用牛刀
❌ React Server Components 重度使用 — VM 是 client 概念

## 与生态的关系

Bizify 不重新发明轮子:

- **响应式底层**:基于 [valtio](https://valtio.dev),Proxy 自动追踪 + 直接 mutate,深度嵌套也能响应
- **服务端状态**:推荐配合 react-query / SWR,VM 只管本地状态
- **表单**:可以接 react-hook-form,VM 持有提交后的业务状态
- **路由**:不耦合,任意路由库适用

## 下一步

- 跟着 [快速开始](/guide/getting-started) 走一遍 5 分钟示例
- 或直接看 [ViewModel 基础](/guide/viewmodel) 了解核心 API
