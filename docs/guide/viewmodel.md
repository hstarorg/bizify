# ViewModel 基础

<script setup>
import Cart from '../demos/cart';
import CartVMSrc from '../demos/cart/vm.ts?raw';
import CartSrc from '../demos/cart/index.tsx?raw';
import Todo from '../demos/todo';
import TodoVMSrc from '../demos/todo/vm.ts?raw';
import TodoSrc from '../demos/todo/index.tsx?raw';
</script>

ViewModel 是 bizify 的核心。所有业务状态、行为和派生数据都写在一个继承 `ViewModelBase` 的类里。

## 定义状态:`$data()`

`$data()` 返回 ViewModel 的初始状态对象,**只在构造时调用一次**:

```ts
interface OrderState {
  items: OrderItem[];
  filter: string;
  sort: 'price' | 'date';
}

class OrderVM extends ViewModelBase<OrderState> {
  protected $data(): OrderState {
    return {
      items: [],
      filter: '',
      sort: 'date',
    };
  }
}
```

返回值会被 valtio 的 `proxy()` 包装成响应式对象,挂在 `this.data`。

## 读取状态:`this.data`

在 VM 类内部,直接通过 `this.data` 读取当前状态,**不用 getState、不用 selector**:

```ts
class OrderVM extends ViewModelBase<OrderState> {
  printItemCount() {
    console.log(this.data.items.length);
  }
}
```

`this.data` 是 valtio 代理,读出来的就是当前最新值。

::: tip 调试时打印
直接 `console.log(vm.data)` 会显示 Proxy 对象,展开不直观。要看普通对象,用 valtio 的 `snapshot()`:

```ts
import { snapshot } from 'valtio';
console.log(snapshot(vm.data));
```
:::

## 修改状态:直接 mutate

bizify 没有 `$set`、没有 `setState`、不用 immer。**直接改就行**:

```ts
class OrderVM extends ViewModelBase<OrderState> {
  setFilter(filter: string) {
    this.data.filter = filter;
  }

  toggleSort() {
    this.data.sort = this.data.sort === 'price' ? 'date' : 'price';
  }

  addItem(item: OrderItem) {
    this.data.items.push(item);   // ← 数组就 push
  }

  removeItem(id: string) {
    const idx = this.data.items.findIndex((i) => i.id === id);
    if (idx >= 0) this.data.items.splice(idx, 1);
  }

  toggleDone(id: string) {
    const item = this.data.items.find((i) => i.id === id);
    if (item) item.done = !item.done;   // ← 嵌套属性直接改
  }
}
```

valtio 把所有变化转发给视图层,**不需要 spread、不需要 immer 包装**。

::: warning render 期间不要 mutate
和 React 的契约一致——render 函数里只能**读**状态,不能**改**状态。改状态只在事件处理器、生命周期方法、异步回调里做。dev 模式下 valtio 会发警告。
:::

## 计算属性:写在 `$data` 的 getter 里

下面这个购物车演示 `subtotal` / `total` / `isEmpty` 三个 computed —— 改 items 或 discount,所有派生值实时更新:

<ReactDemo :component="Cart" :vm-source="CartVMSrc" :component-source="CartSrc" />

派生数据不需要单独的 API——**直接在 `$data()` 返回值里用 getter**:

```ts
type CartState = {
  items: Item[];
  discount: number;
  // ↓ 计算属性声明在类型里
  readonly total: number;
  readonly isEmpty: boolean;
};

class CartVM extends ViewModelBase<CartState> {
  protected $data(): CartState {
    return {
      items: [],
      discount: 0,

      // ─── computed:this 自动是 state 自己 ───
      get total() {
        return this.items.reduce((s, i) => s + i.price, 0) * (1 - this.discount);
      },

      get isEmpty() {
        return this.items.length === 0;
      },
    };
  }

  add(item: Item) {
    this.data.items.push(item);
  }
}
```

视图和业务两处使用完全一致:

```tsx
// 视图:自动追踪 items / discount
function CartFooter() {
  const vm = useViewModel(CartVM);
  const snap = vm.useSnapshot();
  return <div>¥{snap.total} {snap.isEmpty && '(空)'}</div>;
}
```

```ts
// 业务方法
class CartVM {
  checkout() {
    if (this.data.total === 0) return;   // ← 同一个访问路径
    api.checkout(this.data.items);
  }
}
```

### 计算属性互相依赖

直接在 getter 里访问其他 getter:

```ts
protected $data() {
  return {
    items: [] as Item[],
    discount: 0,
    get subtotal() {
      return this.items.reduce((s, i) => s + i.price, 0);
    },
    get total() {
      return this.subtotal * (1 - this.discount);   // ← 用 subtotal
    },
  };
}
```

valtio 会正确处理依赖链。

### 为什么不在类上用 `get` 写 computed

```ts
// ❌ 这样写不会被 snapshot 追踪
class CartVM extends ViewModelBase<CartState> {
  get total() {
    return this.data.items.reduce(...);
  }
}
```

类的 getter 在 VM 上,不在 state proxy 上,**snapshot 看不到它,组件不会自动订阅**。

**所有计算属性都放 `$data()` 的 getter 里**,这是唯一推荐写法。

### 计算属性的约束

- getter 内的 `this` 是 state 对象,**不是 VM 实例**
- 不能 `this.someMethod()` 调 VM 的方法
- 不能 `this.data.x` 访问数据
- 只能读 `this.x`(状态字段或其他计算属性)
- 必须是**纯函数**,不能产生副作用

这些约束让计算属性可缓存、可追踪、可测试。

## 异步方法

异步方法就是普通的 async 函数,内部该 mutate 就 mutate:

```ts
class OrderVM extends ViewModelBase<OrderState & {
  loading: boolean;
  error: string | null;
}> {
  protected $data() {
    return {
      items: [],
      filter: '',
      sort: 'date' as const,
      loading: false,
      error: null,
    };
  }

  async fetchOrders() {
    this.data.loading = true;
    this.data.error = null;
    try {
      const items = await api.getOrders(this.data.filter);
      this.data.items = items;
    } catch (e) {
      this.data.error = String(e);
    } finally {
      this.data.loading = false;
    }
  }
}
```

::: tip 推荐
列表数据 / 详情数据这种"服务端状态"建议用 [react-query](https://tanstack.com/query) 接管,VM 只持本地状态(过滤条件、排序、表单输入等)。两者职责清晰。
:::

## 方法风格:箭头字段 vs 原型方法

ViewModel 构造时会自动把原型链上的方法 `bind(this)` 写到实例上,所以两种写法都能直接当事件处理器传:

```ts
class OrderVM extends ViewModelBase<OrderState> {
  // 风格 A:箭头函数类字段
  setFilter = (filter: string) => {
    this.data.filter = filter;
  };

  // 风格 B:原型方法(自动绑定)
  toggleSort() {
    this.data.sort = this.data.sort === 'price' ? 'date' : 'price';
  }
}

// 都能这样用,this 不会丢
<button onClick={() => vm.setFilter('xxx')} />
<button onClick={vm.toggleSort} />
```

| 风格 | 优势 |
|---|---|
| 箭头字段 | 写法显式;TypeScript 类型推导更直接 |
| 原型方法 | 调试栈更清晰;`super.xxx()` / 继承覆盖更顺;占内存少(原型共享) |

混用也没问题——按方法表达力选即可。

## 完整示例

一个完整的 Todo,涵盖 state、computed、CRUD、过滤切换:

<ReactDemo :component="Todo" :vm-source="TodoVMSrc" :component-source="TodoSrc" />
