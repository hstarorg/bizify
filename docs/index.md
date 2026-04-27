---
layout: home

hero:
  name: Bizify
  text: React MVVM Framework
  tagline: 把业务逻辑写在 ViewModel 里,视图只负责渲染。基于 valtio,直接 mutate + 自动追踪。
  actions:
    - theme: brand
      text: 立即上手
      link: /guide/getting-started
    - theme: alt
      text: 介绍
      link: /guide/

features:
  - icon: 🎯
    title: MVVM 架构
    details: ViewModel 持有状态与行为,View 只关心渲染。业务逻辑可独立单测,不依赖 React。
  - icon: ✏️
    title: 直接 mutate
    details: this.data.x = y、this.data.list.push(item) 都直接生效。不用 setState,不用 spread,不用 immer。
  - icon: ⚡
    title: 自动追踪订阅
    details: vm.useSnapshot() 返回追踪 snapshot,在 render 里读什么订什么。无 selector、无 shallow,无关字段不触发重渲染。
  - icon: 🧮
    title: 计算属性
    details: 在 $data 里直接写 getter。vm.data.total 和 snap.total 行为一致,自动追踪依赖。
  - icon: 🔁
    title: 生命周期 StrictMode 隐形
    details: onMount / onUnmount 永远只在真实进入/离开页面时各触发一次,Vue 风格,不需要写 idempotent。
  - icon: 🌐
    title: SSR 友好
    details: Provider 模式天然支持服务端渲染,初始数据可注入,跨请求隔离。
---
