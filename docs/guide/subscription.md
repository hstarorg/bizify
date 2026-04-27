# 订阅与派生

性能的关键:**只订阅你真正用到的字段**。Bizify 的 selector API 让你可以精确控制每个组件订阅 VM 的哪部分状态。

## 基础用法:`vm.use(selector)`

把 selector 函数传给 `vm.use()`,组件只在选中的字段变化时重渲染:

```tsx
function OrderHeader() {
  const vm = useViewModel(OrderVM);
  const filter = vm.use((s) => s.filter);   // ← 只订阅 filter
  return <input value={filter} onChange={e => vm.setFilter(e.target.value)} />;
}

function OrderList() {
  const vm = useViewModel(OrderVM);
  const items = vm.use((s) => s.items);     // ← 只订阅 items
  return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

`vm.setFilter('xxx')` 只触发 `OrderHeader` 重渲染,`OrderList` 不重渲染。反之亦然。

## 多字段订阅:shallow

如果想一次订阅多个字段,直接返回对象会导致**每次都是新引用**,默认的 `Object.is` 比较会判定为变化。**第二个参数传 `'shallow'`** 启用浅比较:

```tsx
function OrderToolbar() {
  const vm = useViewModel(OrderVM);

  // ❌ 每次都返回新对象,组件每次都重渲染
  const { filter, sort } = vm.use((s) => ({ filter: s.filter, sort: s.sort }));

  // ✅ 浅比较,只在 filter 或 sort 真的变了时重渲染
  const { filter, sort } = vm.use(
    (s) => ({ filter: s.filter, sort: s.sort }),
    'shallow',
  );
}
```

## 订阅整个状态(不推荐)

不传 selector 会订阅整个状态,任意字段变化都会重渲染:

```tsx
const all = vm.use();  // ⚠️ 任何字段变化都重渲染
```

只在简单场景或调试时用。

## 派生数据:`useDerived`

如果想订阅 VM 上的 class getter(派生数据),用 `useDerived`:

```ts
class CartVM extends ViewModelBase<{ items: Item[] }> {
  protected $data() { return { items: [] }; }

  get total() {
    return this.data.items.reduce((s, i) => s + i.price, 0);
  }
}
```

```tsx
function CartTotal() {
  const vm = useViewModel(CartVM);
  const total = vm.useDerived((v) => v.total);   // ← 派生数据订阅
  return <div>Total: ${total}</div>;
}
```

`useDerived` 在 VM 状态变化时重新计算 getter,只在结果实际变化时(`Object.is` 比较)才重渲染。

::: tip
- 想要 selector 类型的精确订阅 → `vm.use(s => s.x)`
- 想要订阅 class getter / 计算属性 → `vm.useDerived(v => v.computed)`
- 多字段且想浅比较 → `vm.use(s => ({...}), 'shallow')`
:::

## 何时该订阅,何时不该

```tsx
function MyComponent() {
  const vm = useViewModel(OrderVM);

  // ✅ 视图要用 → 订阅
  const items = vm.use((s) => s.items);

  // ✅ 调用方法不需要订阅,直接用 vm.xxx
  const onClick = () => vm.fetchOrders();

  // ❌ 不要这样:这其实是订阅整个 state
  const filter = vm['data'].filter;

  return <button onClick={onClick}>{items.length}</button>;
}
```

**记住**:`vm.use(...)` 才是订阅,`this.data` 是 VM 内部读快照用的。

## 性能小贴士

1. **selector 越窄越好**:`(s) => s.items.length` 比 `(s) => s.items` 更细——前者只在长度变化时重渲染
2. **避免在 selector 里创建对象**:除非用 shallow 比较,否则会爆炸性重渲染
3. **派生数据走 getter + useDerived**:不要把派生值塞进 state,那样每次修改源字段都得手动同步派生字段
