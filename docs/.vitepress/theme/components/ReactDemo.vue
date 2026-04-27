<script setup lang="ts">
import {
  computed,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import { createElement, type ComponentType } from 'react';

const props = defineProps<{
  component: ComponentType<any>;
  props?: Record<string, unknown>;
  /** Raw VM source code,通常用 ?raw 引入 */
  vmSource?: string;
  /** Raw component source code,通常用 ?raw 引入 */
  componentSource?: string;
  /** vm 源码语言,默认 ts */
  vmLang?: string;
  /** 组件源码语言,默认 tsx */
  componentLang?: string;
}>();

type Tab = 'preview' | 'vm' | 'component';
const tab = ref<Tab>('preview');

const hasVm = computed(() => !!props.vmSource);
const hasComp = computed(() => !!props.componentSource);

// ─── React mount ─────────────────────────────────────
const containerRef = ref<HTMLElement | null>(null);
let root: Root | null = null;

const renderReact = () => {
  if (!root || !props.component) return;
  root.render(createElement(props.component, props.props || {}));
};

onMounted(() => {
  if (!containerRef.value) return;
  root = createRoot(containerRef.value);
  renderReact();
});

watch(() => [props.component, props.props], renderReact, { deep: true });

onBeforeUnmount(() => {
  root?.unmount();
  root = null;
});

// ─── shiki 运行时高亮(精确导入,只打需要的 lang / theme)────────
type Highlighter = {
  codeToHtml: (code: string, options: any) => string;
};

let highlighterPromise: Promise<Highlighter> | null = null;
const getHighlighter = (): Promise<Highlighter> => {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [
        { createHighlighterCore },
        { createJavaScriptRegexEngine },
        githubLight,
        githubDark,
        ts,
        tsx,
      ] = await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
        import('shiki/themes/github-light.mjs'),
        import('shiki/themes/github-dark.mjs'),
        import('shiki/langs/ts.mjs'),
        import('shiki/langs/tsx.mjs'),
      ]);
      return (await createHighlighterCore({
        themes: [githubLight.default, githubDark.default],
        langs: [ts.default, tsx.default],
        engine: createJavaScriptRegexEngine(),
      })) as unknown as Highlighter;
    })();
  }
  return highlighterPromise;
};

const highlightedVm = ref('');
const highlightedComp = ref('');

const renderHighlight = async () => {
  const hi = await getHighlighter();
  const opts = (lang: string) => ({
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
  if (props.vmSource) {
    highlightedVm.value = hi.codeToHtml(
      props.vmSource,
      opts(props.vmLang ?? 'ts'),
    );
  }
  if (props.componentSource) {
    highlightedComp.value = hi.codeToHtml(
      props.componentSource,
      opts(props.componentLang ?? 'tsx'),
    );
  }
};

onMounted(renderHighlight);
watch(
  () => [props.vmSource, props.componentSource, props.vmLang, props.componentLang],
  renderHighlight,
);
</script>

<template>
  <div class="react-demo">
    <div class="react-demo__tabs" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'preview'"
        :class="['react-demo__tab', { 'is-active': tab === 'preview' }]"
        @click="tab = 'preview'"
      >
        预览
      </button>
      <button
        v-if="hasVm"
        type="button"
        role="tab"
        :aria-selected="tab === 'vm'"
        :class="['react-demo__tab', { 'is-active': tab === 'vm' }]"
        @click="tab = 'vm'"
      >
        ViewModel
      </button>
      <button
        v-if="hasComp"
        type="button"
        role="tab"
        :aria-selected="tab === 'component'"
        :class="['react-demo__tab', { 'is-active': tab === 'component' }]"
        @click="tab = 'component'"
      >
        组件
      </button>
    </div>

    <div
      v-show="tab === 'preview'"
      class="react-demo__pane react-demo__preview"
    >
      <div ref="containerRef" class="react-demo__mount" />
    </div>

    <div
      v-if="hasVm"
      v-show="tab === 'vm'"
      class="react-demo__pane react-demo__code"
      v-html="highlightedVm || `<pre>${props.vmSource}</pre>`"
    />

    <div
      v-if="hasComp"
      v-show="tab === 'component'"
      class="react-demo__pane react-demo__code"
      v-html="highlightedComp || `<pre>${props.componentSource}</pre>`"
    />
  </div>
</template>

<style scoped>
.react-demo {
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.react-demo__tabs {
  display: flex;
  gap: 4px;
  padding: 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.react-demo__tab {
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.react-demo__tab:hover {
  color: var(--vp-c-text-1);
}

.react-demo__tab.is-active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.react-demo__preview {
  padding: 24px;
}

.react-demo__mount :deep(button) {
  cursor: pointer;
}

/* shiki 输出贴边 */
.react-demo__code :deep(pre.shiki) {
  margin: 0;
  padding: 16px 20px;
  border-radius: 0;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}
.react-demo__code :deep(pre.shiki .line) {
  white-space: pre;
}

/* dual-theme 切换 */
html.dark .react-demo__code :deep(pre.shiki .shiki-light),
html.dark .react-demo__code :deep(pre.shiki span.shiki-light) {
  display: none;
}
html:not(.dark) .react-demo__code :deep(pre.shiki .shiki-dark),
html:not(.dark) .react-demo__code :deep(pre.shiki span.shiki-dark) {
  display: none;
}

/* fallback 时纯文本 pre 样式 */
.react-demo__code :deep(pre):not(.shiki) {
  margin: 0;
  padding: 16px 20px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
}
</style>
