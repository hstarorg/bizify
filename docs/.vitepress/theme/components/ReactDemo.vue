<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import { createElement, type ComponentType } from 'react';

const props = defineProps<{
  component: ComponentType<any>;
  props?: Record<string, unknown>;
}>();

type Tab = 'preview' | 'code';
const tab = ref<Tab>('preview');

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

// 用 v-show 而非 v-if,避免切 tab 时 React mount 节点被销毁
watch(() => [props.component, props.props], renderReact, { deep: true });

onBeforeUnmount(() => {
  root?.unmount();
  root = null;
});
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
        type="button"
        role="tab"
        :aria-selected="tab === 'code'"
        :class="['react-demo__tab', { 'is-active': tab === 'code' }]"
        @click="tab = 'code'"
      >
        代码
      </button>
    </div>

    <div v-show="tab === 'preview'" class="react-demo__pane react-demo__preview">
      <div ref="containerRef" class="react-demo__mount" />
    </div>

    <div v-show="tab === 'code'" class="react-demo__pane react-demo__code">
      <slot />
    </div>
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

/* 让 slot 里的 ```tsx 代码块和容器贴边 */
.react-demo__code :deep(div[class*='language-']) {
  margin: 0;
  border-radius: 0;
}
.react-demo__code :deep(pre) {
  border-radius: 0;
}
</style>
