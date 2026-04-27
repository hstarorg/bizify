import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import ReactDemo from './components/ReactDemo.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ReactDemo', ReactDemo);
  },
} satisfies Theme;
