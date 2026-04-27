# ViewModel 基础

ViewModel 是 bizify 的核心。所有业务状态和行为都写在继承 `ViewModelBase` 的类里。

## 定义状态:`$data()`

`$data()` 返回 ViewModel 的初始状态,**只在构造时调用一次**:

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

## 读取状态:`this.data`

在 VM 类内部,通过 `this.data` 读当前快照(非响应式):

```ts
class OrderVM extends ViewModelBase<OrderState> {
  // ...
  printItemCount = () => {
    console.log(this.data.items.length);
  };
}
```

## 更新状态:`$set()`

`$set` 接受**部分对象**或**更新函数**两种形式:

```ts
class OrderVM extends ViewModelBase<OrderState> {
  // 部分对象
  setFilter = (filter: string) => this.$set({ filter });

  // 更新函数(适合依赖前一个状态)
  toggleSort = () =>
    this.$set((s) => ({ sort: s.sort === 'price' ? 'date' : 'price' }));

  addItem = (item: OrderItem) =>
    this.$set((s) => ({ items: [...s.items, item] }));
}
```

::: tip
`$set` 永远是**浅合并**——只有传入的字段会被更新,其他字段保持不变。不需要手动展开 `...this.data`。
:::

## 方法风格:箭头字段 vs 原型方法

ViewModel 构造时会自动把原型链上的方法 `bind(this)` 写到实例上,所以两种写法都能直接当事件处理器传:

```ts
class OrderVM extends ViewModelBase<OrderState> {
  // 风格 A:箭头函数类字段
  setFilter = (filter: string) => this.$set({ filter });

  // 风格 B:原型方法(自动绑定)
  toggleSort() {
    this.$set((s) => ({ sort: s.sort === 'price' ? 'date' : 'price' }));
  }
}

// 都能这样用,this 不会丢
<button onClick={vm.setFilter('xxx')} />
<button onClick={vm.toggleSort} />
```

| 风格 | 优势 |
|---|---|
| 箭头字段 | 写法显式;TypeScript 类型推导更直接 |
| 原型方法 | 调试栈更清晰;`super.xxx()` / 继承覆盖更顺;占内存少(原型共享) |

混用也没问题——按方法表达力选即可。

## 异步方法

异步方法就是普通的 async 函数,内部该 `$set` 就 `$set`:

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

  fetchOrders = async () => {
    this.$set({ loading: true, error: null });
    try {
      const items = await api.getOrders(this.data.filter);
      this.$set({ items, loading: false });
    } catch (e) {
      this.$set({ loading: false, error: String(e) });
    }
  };
}
```

::: tip 推荐
异步状态(列表数据、详情页数据)推荐用 [react-query](https://tanstack.com/query) 接管,VM 只管本地状态(过滤条件、排序、表单输入等)。两者职责清晰。
:::

## 派生数据:用 getter

派生数据(computed)直接写 class getter:

```ts
class CartVM extends ViewModelBase<{ items: Item[] }> {
  protected $data() {
    return { items: [] as Item[] };
  }

  get total() {
    return this.data.items.reduce((s, i) => s + i.price, 0);
  }

  get isEmpty() {
    return this.data.items.length === 0;
  }
}
```

视图里订阅派生数据用 `useDerived`(详见[订阅与派生](/guide/subscription)):

```tsx
const total = vm.useDerived((v) => v.total);
```

## 完整示例

```ts
import { ViewModelBase } from 'bizify';

interface TodoState {
  items: Todo[];
  filter: 'all' | 'active' | 'done';
  draft: string;
}

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export class TodoVM extends ViewModelBase<TodoState> {
  protected $data(): TodoState {
    return { items: [], filter: 'all', draft: '' };
  }

  // ── 派生数据
  get visibleItems() {
    const { items, filter } = this.data;
    if (filter === 'active') return items.filter((t) => !t.done);
    if (filter === 'done') return items.filter((t) => t.done);
    return items;
  }

  get remaining() {
    return this.data.items.filter((t) => !t.done).length;
  }

  // ── 行为
  setDraft = (draft: string) => this.$set({ draft });

  setFilter = (filter: TodoState['filter']) => this.$set({ filter });

  add = () => {
    const text = this.data.draft.trim();
    if (!text) return;
    this.$set((s) => ({
      items: [...s.items, { id: crypto.randomUUID(), text, done: false }],
      draft: '',
    }));
  };

  toggle = (id: string) =>
    this.$set((s) => ({
      items: s.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));

  remove = (id: string) =>
    this.$set((s) => ({ items: s.items.filter((t) => t.id !== id) }));

  clearDone = () =>
    this.$set((s) => ({ items: s.items.filter((t) => !t.done) }));
}
```
