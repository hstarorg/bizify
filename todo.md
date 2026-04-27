# Bizify 1.0 改造计划

把 bizify 重构为「基于 zustand 的轻量 React MVVM 框架」。允许全量删除现有代码,无历史包袱。

## 目标定位

- 名称:bizify(品牌沿用)
- 概念:ViewModel(替换 Controller 命名)
- 底层:zustand(替换自研 Proxy + EventEmitter)
- 包结构:单包多 exports(`bizify` + `bizify/core`)
- 工具链:Vite + Rolldown + Vitest + VitePress + oxlint

## 核心 API 设计

```ts
// 核心(框架无关)
import { ViewModelBase } from 'bizify/core';
//   - 基于 zustand/vanilla
//   - 暴露:data, $set, $subscribe, 生命周期钩子, dispose
//   - 不含 React hooks

// React 绑定
import { ViewModelBase, useViewModel, createViewModelContext } from 'bizify';
//   - ViewModelBase 继承 core,扩展 use / useDerived(React hooks)
//   - useViewModel(VM):组件局部实例 + 生命周期绑定
//   - createViewModelContext(VM):Provider + useVM(子树共享 / SSR 友好)
```

## 生命周期钩子

`ViewModelBase` 暴露给子类重写:

- `onInit()` — 构造时调用,同步初始化
- `onMount()` — 首个 View 挂载时(引用计数)
- `onUnmount()` — 最后一个 View 卸载时
- `onDispose()` — 实例销毁时(组件 unmount / Provider 卸载)

## 目录结构

```
bizify/
├── src/
│   ├── core/
│   │   ├── ViewModelBase.ts        # vanilla zustand + 生命周期
│   │   └── index.ts
│   ├── react/
│   │   ├── ViewModelBase.ts        # 继承 core,加 use / useDerived
│   │   ├── useViewModel.ts         # 组件局部 hook
│   │   ├── createViewModelContext.ts  # Provider + useVM
│   │   └── index.ts
│   └── index.ts                    # = react/index.ts
├── test/
│   ├── setup.ts
│   ├── core.test.ts
│   ├── useViewModel.test.tsx
│   └── createViewModelContext.test.tsx
├── docs/                            # VitePress 站(后续)
│   ├── .vitepress/config.ts
│   └── guide/
├── rolldown.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## 执行步骤

### 阶段一:清理 + 重建脚手架

- [ ] 删除 `packages/`、`lerna.json`、`pnpm-workspace.yaml`、`.dumirc.ts`、`.eslintrc.js`、`.stylelintrc`、`.prettierrc.js`、`.prettierignore`、`.editorconfig`、`scripts/`、`docs-dist/`、`CHANGELOG.md`、`tea.yaml`、`pnpm-lock.yaml`、`node_modules/`
- [ ] 删除根 `tsconfig.json`、`package.json`(后面重写)
- [ ] 保留:`.git/`、`.husky/`、`.gitignore`、`LICENSE`、`README.md`(后续重写)、`docs/`(markdown 内容,后续迁移)

### 阶段二:新基础配置

- [ ] 写新的 `package.json`:单包、`type: module`、exports 字段、scripts
- [ ] 写新的 `tsconfig.json`:`moduleResolution: Bundler`、`strict`
- [ ] 安装依赖:zustand、react(peer/dev)、vitest、@testing-library/react、jsdom、rolldown、typescript、oxlint

### 阶段三:核心实现

- [ ] `src/core/ViewModelBase.ts`:基于 `zustand/vanilla`,含生命周期 + 引用计数 + `$set` + `$subscribe` + `data` getter + `dispose`
- [ ] `src/core/index.ts`:re-export
- [ ] `src/react/ViewModelBase.ts`:继承 core,加 `use<U>(selector, equality?)` + `useDerived<U>(fn)`
- [ ] `src/react/useViewModel.ts`:`useState(() => new Ctor())` + mount/unmount/dispose 绑定
- [ ] `src/react/createViewModelContext.ts`:Provider + useVM hook,支持 initial 注入(SSR)
- [ ] `src/react/index.ts`:re-export 全部 React 公开 API
- [ ] `src/index.ts`:re-export react/

### 阶段四:测试

- [ ] `vitest.config.ts`:jsdom 环境
- [ ] `test/setup.ts`:`@testing-library/jest-dom/vitest`
- [ ] `test/core.test.ts`:基类行为(状态、`$set`、订阅、生命周期、dispose)
- [ ] `test/useViewModel.test.tsx`:组件挂载/卸载、状态更新触发重渲染、selector 细粒度订阅
- [ ] `test/createViewModelContext.test.tsx`:Provider 共享、initial 注入、子树卸载销毁
- [ ] `pnpm test` 全绿

### 阶段五:构建

- [ ] `rolldown.config.ts`:多入口(index + core),ESM + CJS,external react/zustand
- [ ] dts 生成:`tsc --emitDeclarationOnly`(单独脚本,确保稳定)
- [ ] `pnpm build` 跑通,`pnpm pack` 检查产物

### 阶段六:lint

- [ ] `.oxlintrc.json` 或直接命令行配置
- [ ] `pnpm lint` 跑通
- [ ] 更新 `.husky/pre-commit` 和 `lint-staged` 用 oxlint

### 阶段七:文档站(VitePress)

- [ ] 装 vitepress、@vitejs/plugin-react
- [ ] `docs/.vitepress/config.ts`:导航、侧边栏、base 路径
- [ ] `docs/index.md`:首页
- [ ] `docs/guide/` 内容重写(对齐 ViewModel API 和新名词)
- [ ] `pnpm docs:dev` 本地预览,`pnpm docs:build` 产物输出 `docs-dist/`
- [ ] gh-pages 部署脚本保留

### 阶段八:收尾

- [ ] 重写 README.md(英文为主、附中文,定位为 React MVVM Framework)
- [ ] 更新 .gitignore
- [ ] 验证:install → test → build → docs:build 全部通过
- [ ] 不自动 commit,留给用户检视

## 不在这次范围内的

- AsyncService(异步服务封装)— 第一版先不做,推荐用户搭配 react-query
- VMContainer(全局容器)— 简单场景用 createViewModelContext 足够
- Computed(派生数据自动缓存)— 第一版用 `useDerived` 顶替
- Vue / Solid 绑定 — 现阶段只做 React
- 旧 API 兼容层 — 用户已确认无历史包袱,直接断
