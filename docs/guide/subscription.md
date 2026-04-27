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

## 多字段订阅

字段一多,一个个写 selector 就太啰嗦了。三种写法,**优先用 `usePick`**:

```tsx
function OrderToolbar() {
  const vm = useViewModel(OrderVM);

  // ✅ 推荐:usePick——字段名只写一次,内部 shallow 比较
  const { filter, sort } = vm.usePick('filter', 'sort');

  // ⚠️ 也行:use + 对象 + shallow,等价但啰嗦
  const { filter, sort } = vm.use(
    (s) => ({ filter: s.filter, sort: s.sort }),
    'shallow',
  );

  // ❌ 不要:返回对象不加 shallow,每次都是新引用,无效重渲染爆炸
  const { filter, sort } = vm.use((s) => ({ filter: s.filter, sort: s.sort }));
}
```

`usePick` 的类型签名:`<K extends keyof T>(...keys: K[]): Pick<T, K>`——TypeScript 会准确推导出返回类型,IDE 自动补全 keys。

::: tip 字段越多越值得用 usePick
- 1 个字段 → `vm.use(s => s.x)` 最直接
- 2 个以上 → `vm.usePick(...)` 更短
- 想订阅全状态 → 应该重新审视组件粒度,通常意味着应该拆成多个组件
:::

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
