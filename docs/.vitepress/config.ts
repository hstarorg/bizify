import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitepress';
import react from '@vitejs/plugin-react';

export default defineConfig({
  title: 'Bizify',
  description: 'Lightweight React MVVM framework backed by valtio',
  base: '/bizify/',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    logo: 'https://cdn1.hstar.vip/logo.png',
    nav: [
      { text: '指南', link: '/guide/' },
      { text: 'GitHub', link: 'https://github.com/hstarorg/bizify' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '介绍', link: '/guide/' },
            { text: '快速开始', link: '/guide/getting-started' },
          ],
        },
        {
          text: '核心',
          items: [
            { text: 'ViewModel 基础', link: '/guide/viewmodel' },
            { text: '订阅与派生', link: '/guide/subscription' },
            { text: '生命周期', link: '/guide/lifecycle' },
            { text: 'Provider 与 SSR', link: '/guide/provider' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/hstarorg/bizify' },
    ],
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present hstarorg',
    },
  },

  vite: {
    plugins: [
      // 仅对 .tsx/.jsx 文件应用 React,不影响 VitePress 的 Vue 处理
      react({
        include: ['**/*.tsx', '**/*.jsx'],
      }),
    ],
    resolve: {
      alias: {
        // 文档示例直接吃源码,改 src/ 即时反映
        bizify: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
        'bizify/core': fileURLToPath(
          new URL('../../src/core/index.ts', import.meta.url),
        ),
      },
    },
    ssr: {
      // demo 文件 import bizify,SSR 阶段也需要它能被解析
      noExternal: ['bizify'],
    },
  },
});
