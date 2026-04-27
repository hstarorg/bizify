# 订阅与派生

bizify 用 valtio 的自动追踪做订阅——**你在 render 里读了什么字段,组件就只订阅那些字段**。无需 selector,无需 shallow,无需手动声明依赖。

## 基础用法:`vm.useSnapshot()`

`vm.useSnapshot()` 返回一份 valtio snapshot——表面看是普通对象,实际是个**追踪 Proxy**:

```tsx
function OrderHeader() {
  const vm = useViewModel(OrderVM);
  const snap = vm.useSnapshot();   // 追踪 Proxy
  // 读 snap.filter → 这个组件只订阅 filter
  // 不读 snap.items → items 变化不重渲染
  return (
    <input value={snap.filter} onChange={(e) => vm.setFilter(e.target.value)} />
  );
}

function OrderTable() {
  const vm = useViewModel(OrderVM);
  const snap = vm.useSnapshot();
  return (
    <ul>
      {snap.items.map((i) => <li key={i.id}>{i.name}</li>)}
    </ul>
  );
}
```

修改 `vm.data.filter` 只重渲染 `OrderHeader`;修改 `vm.data.items` 只重渲染 `OrderTable`。**不写一行 selector**。

## 嵌套字段也自动追踪

```tsx
function UserBadge() {
  const vm = useViewModel(UserVM);
  const snap = vm.useSnapshot();
  return <span>{snap.user.profile.name}</span>;
  // 订阅:user.profile.name
  // 修改 user.profile.email → 不重渲染
  // 修改 user.profile.name → 重渲染
}
```

valtio 的 Proxy 是递归的,深层属性变化会**沿 read 路径反查依赖**,不会误触发。

## 派生数据:写在 `$data` 的 getter 里

不需要单独的 `useDerived` / `useComputed` API——**计算属性写在 `$data()` 返回值的 getter 里就行**:

```ts
type CartState = {
  items: Item[];
  discount: number;
  readonly total: number;
};

class CartVM extends ViewModelBase<CartState> {
  protected $data(): CartState {
    return {
      items: [],
      discount: 0,
      get total() {
        return this.items.reduce((s, i) => s + i.price, 0) * (1 - this.discount);
      },
    };
  }
}
```

视图里直接当成普通字段读:

```tsx
function CartTotal() {
  const vm = useViewModel(CartVM);
  const { total } = vm.useSnapshot();
  return <div>¥{total}</div>;
  // 订阅:total → 实际依赖 items 和 discount,任一变化都重渲染
}
```

详细规则见 [ViewModel 基础 - 计算属性](./viewmodel#计算属性-写在-data-的-getter-里)。

## 关键纪律

```tsx
function MyComponent() {
  const vm = useViewModel(OrderVM);

  // ✅ 视图里:走 use() 的 snapshot
  const snap = vm.useSnapshot();
  return <div>{snap.items.length}</div>;

  // ✅ 调用方法不需要订阅,直接 vm.xxx
  const onClick = () => vm.fetchOrders();

  // ❌ 不要这样:vm.data 是 live proxy,在 render 中访问不会被追踪
  const items = vm.data.items;
  return <div>{items.length}</div>;
}
```

记住:**`vm.useSnapshot()` 返回的 snap 是订阅入口,`vm.data` 是 mutation 入口**。

## 命令式订阅

业务逻辑里(非视图)需要订阅状态变化时,用 `$subscribe` 或 `$watch`:

### `$subscribe`:监听任何变化

```ts
class TimerVM extends ViewModelBase<{ tick: number }> {
  $data() { return { tick: 0 }; }

  protected onMount() {
    // 任何 state 变化都触发 callback
    this.unsub = this.$subscribe(() => {
      console.log('state changed');
    });
  }

  protected onUnmount() {
    this.unsub?.();
  }

  private unsub?: () => void;
}
```

callback 不带参数。需要当前状态用 `import { snapshot } from 'valtio'; snapshot(this.data)`。

### `$watch`:监听特定字段

```ts
class ThemeVM extends ViewModelBase<{ mode: 'light' | 'dark' }> {
  $data() { return { mode: 'light' as const }; }

  protected onMount() {
    this.unsub = this.$watch('mode', (newMode) => {
      localStorage.setItem('theme', newMode);
    });
  }

  protected onUnmount() {
    this.unsub?.();
  }

  toggle() {
    this.data.mode = this.data.mode === 'light' ? 'dark' : 'light';
  }

  private unsub?: () => void;
}
```

`$watch(key, cb)` 只在该 key 变化时触发,callback 接收新值。底层是 valtio 的 `subscribeKey`。

::: tip $subscribe vs $watch
- 想监听整个 state 的任意变化 → `$subscribe`
- 想监听单个字段 → `$watch`(更精确,性能更好)
- 想监听派生表达式(`a + b > 10`) → `$subscribe` 内部自己比对,或者把表达式做成 computed 然后 `$watch` computed key
:::

## 性能小贴士

1. **拆组件比挑订阅更有效**:一个组件订阅 6+ 个字段意味着组件太大。拆成多个子组件,每个只订自己关心的几个。
2. **不要把 snap 存到 ref / state 里**:存了就脱离追踪上下文,后续读取不会触发重订阅。每次 render 重新 `vm.useSnapshot()`。
3. **派生数据走 `$data` 的 getter**:不要在 render 里算 `snap.items.reduce(...)`,放到 computed 里,**计算结果会缓存**,且依赖追踪精确。
