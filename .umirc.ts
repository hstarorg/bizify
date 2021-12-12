import { defineConfig } from 'dumi';

// more config: https://d.umijs.org/config
export default defineConfig({
  title: 'Bizify',
  mode: 'site',
  favicon: 'https://cdn1.hstar.vip/logo.png',
  logo: 'https://cdn1.hstar.vip/logo.png',
  outputPath: 'docs-dist',
  history: { type: 'hash' },
  hash: true,
});
