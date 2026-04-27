# Provider 与 SSR

<script setup>
import SharedCart from '../demos/SharedCart.tsx';
</script>

`useViewModel` 适合**组件局部 VM**(每个组件一个独立实例)。但有些场景需要**多组件共享同一个 VM**:

- 一个页面的多个组件共享 `CartVM`
- 全局用户信息 / 主题
- SSR 需要每个请求独立的 VM 实例

这时候用 `createViewModelContext`。

## 基础用法

下面这个示例三个独立子组件 — `Header`(订阅 count)、`Picker`(只调方法)、`Footer`(订阅 subtotal)— 共享同一个 `SharedCartVM` 实例。点 Picker 的 +,Header 和 Footer 立刻同步更新:

<ReactDemo :component="SharedCart">

```tsx
import { ViewModelBase, createViewModelContext } from 'bizify';

class SharedCartVM extends ViewModelBase<{
  items: { id: string; name: string; price: number }[];
  readonly subtotal: number;
  readonly count: number;
}> {
  protected $data() {
    return {
      items: [],
      get subtotal() { return this.items.reduce((s, i) => s + i.price, 0); },
      get count() { return this.items.length; },
    };
  }
  add(item: { id: string; name: string; price: number }) {
    this.data.items.push(item);
  }
  clear() { this.data.items = []; }
}

const { Provider: CartProvider, useVM: useCart } =
  createViewModelContext(SharedCartVM);

function Header() {
  const cart = useCart();
  const snap = cart.useSnapshot();
  return <span>购物车({snap.count})</span>;
}

function Footer() {
  const cart = useCart();
  const snap = cart.useSnapshot();
  return <span>合计:¥{snap.subtotal}</span>;
}

function Picker() {
  const cart = useCart();
  return (
    <button onClick={() => cart.add({ id: 'a', name: '苹果', price: 5 })}>
      + 苹果
    </button>
  );
}

export default function SharedCart() {
  return (
    <CartProvider>
      <Header />
      <Picker />
      <Footer />
    </CartProvider>
  );
}
```

</ReactDemo>

整理一下抽离 store 的写法:

```ts
// stores/cart.ts
import { ViewModelBase, createViewModelContext } from 'bizify';

class CartVM extends ViewModelBase<{ items: CartItem[] }> {
  protected $data() { return { items: [] as CartItem[] }; }
  add(item: CartItem) {
    this.data.items.push(item);
  }
}

export const { Provider: CartProvider, useVM: useCart } =
  createViewModelContext(CartVM);
```

在子树挂 Provider:

```tsx
function CartPage() {
  return (
    <CartProvider>
      <CartHeader />
      <CartItems />
      <CartFooter />
    </CartProvider>
  );
}
```

任意子组件用 `useCart()` 拿到同一实例:

```tsx
function CartHeader() {
  const cart = useCart();
  const snap = cart.useSnapshot();
  return <span>购物车 ({snap.items.length})</span>;
}

function CartItems() {
  const cart = useCart();
  const snap = cart.useSnapshot();
  return (
    <ul>{snap.items.map((i) => <li key={i.id}>{i.name}</li>)}</ul>
  );
}
```

`CartHeader` 和 `CartItems` **共享**同一个 `CartVM` 实例,任何一方调用 `cart.add(...)` 双方都会更新。

## Provider 的生命周期

Provider 管理 VM 实例的生命周期:

- Provider mount → `new CartVM()` → `onInit()` → `onMount()`
- Provider unmount → `onUnmount()`

子组件订阅/取消订阅不影响 VM 生命周期。

::: warning onDispose 不会自动触发
为了在 React 18 StrictMode 下保持安全,Provider **不会**自动调用 `vm.$dispose()`。
所有跟随视图生命周期的清理(定时器、事件监听等)放在 `onUnmount` 里。
`onDispose` 仅在你显式调用 `vm.$dispose()` 时触发,适合容器/注册表等手动管理实例的场景。
:::

## 注入初始数据

`Provider` 接受 `initial` prop,会**浅合并**到 `$data()` 返回值之上:

```tsx
<CartProvider initial={{ items: preloadedItems }}>
  <CartPage />
</CartProvider>
```

VM 构造函数接收 `initial` 后,优先用它。这是 SSR 数据注入的关键。

::: warning initial 只读一次
`initial` prop **只在 Provider 第一次渲染时被读取**,后续 prop 变化不会重建 VM——这是为了 SSR hydrate 后状态稳定。
如果你需要动态切换状态,在 VM 上暴露一个方法,从外部调用即可。
:::

## SSR 模式

### 反例:模块单例

```ts
// ❌ 千万别这么写
export const cartVM = new CartVM();
```

服务端是常驻进程,这个实例会**在所有请求间共享状态**——A 用户的购物车会泄漏给 B 用户。

### 正解:Provider + 工厂

服务端每次请求创建一个新 VM,通过 Provider 注入:

```tsx
// pages/cart.tsx (Next.js Pages Router 示例)
export async function getServerSideProps() {
  const items = await fetchCart();
  return { props: { initialItems: items } };
}

export default function CartPage({ initialItems }) {
  return (
    <CartProvider initial={{ items: initialItems }}>
      <CartHeader />
      <CartItems />
    </CartProvider>
  );
}
```

服务端 render 时:
1. `CartProvider` 用 `initialItems` `new CartVM()`
2. 子组件 `useCart().use(...)` 同步读到这份数据
3. 输出 HTML 包含正确的初始 UI
4. 客户端 hydrate 时 `initialItems` 通过 props 传过去,VM 用同一份数据初始化 → 不会出现 hydration mismatch

### React Server Components(App Router)

VM 是 client 概念,**不能在 server component 里用**。在 server component 里预取数据,推到 client 边界:

```tsx
// app/cart/page.tsx (RSC)
export default async function CartPage() {
  const items = await db.cart.findMany();   // 服务端
  return <CartClient initialItems={items} />;
}

// app/cart/CartClient.tsx
'use client';
export function CartClient({ initialItems }) {
  return (
    <CartProvider initial={{ items: initialItems }}>
      <CartHeader />
      <CartItems />
    </CartProvider>
  );
}
```

## 全局 VM(应用根 Provider)

如果 VM 是全局唯一的(用户、主题、通知),把 Provider 挂到应用根:

```tsx
// App.tsx
function App() {
  return (
    <UserProvider initial={{ user: getInitialUser() }}>
      <ThemeProvider>
        <Routes />
      </ThemeProvider>
    </UserProvider>
  );
}
```

任何位置 `useUser()` 都拿得到。

## 嵌套 Provider 的注意点

每个 Provider 创建**自己的实例**。如果你不小心嵌套了同名 Provider,内层 `useXxx()` 会拿到内层的实例:

```tsx
<CartProvider>          {/* 实例 A */}
  <SomeCart />          {/* 用 A */}
  <CartProvider>        {/* 实例 B */}
    <NestedCart />      {/* 用 B */}
  </CartProvider>
</CartProvider>
```

这通常不是你想要的——**一个 VM 类对应一个 Provider 位置**。如果真有需求(对话框里独立的购物车),也要意识到状态是隔离的。

## `useViewModel` vs `createViewModelContext` 怎么选

| 场景 | 用 |
|---|---|
| 组件局部状态(详情页、表单、向导) | `useViewModel(VM)` |
| 子树共享(购物车页面下多个组件)| `createViewModelContext` + 子树 Provider |
| 全局唯一(用户、主题、通知)| `createViewModelContext` + 应用根 Provider |
| SSR | `createViewModelContext`,**禁用模块单例** |
