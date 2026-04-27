---
layout: home

hero:
  name: Bizify
  text: React MVVM Framework
  tagline: 把业务逻辑写在 ViewModel 里,视图只负责渲染。基于 zustand 的轻量框架。
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
  - icon: ⚡
    title: 细粒度订阅
    details: 基于 zustand 的 selector,只订阅需要的字段。无关字段变化不触发重渲染。
  - icon: 🔁
    title: 生命周期钩子
    details: onInit、onMount、onUnmount、onDispose 一应俱全,引用计数自动管理共享实例。
  - icon: 🌐
    title: SSR 友好
    details: Provider 模式天然支持服务端渲染,初始数据可注入,跨请求隔离。
  - icon: 📦
    title: 轻量零负担
    details: 不到 1KB,基于 zustand。可与 react-query、react-hook-form 等生态自由组合。
  - icon: 🧩
    title: 类风格 OOP
    details: 继承、组合、封装。复杂业务用类组织,告别 hook 闭包陷阱与依赖数组。
---
