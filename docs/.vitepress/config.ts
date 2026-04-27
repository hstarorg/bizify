import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Bizify',
  description: 'Lightweight React MVVM framework backed by zustand',
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
});
