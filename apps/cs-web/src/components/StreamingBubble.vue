<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";

const props = defineProps<{ content: string }>();

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const rendered = computed(() => md.render(props.content));
</script>

<template>
  <div class="bubble-row">
    <div class="avatar bot-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4Z" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <circle cx="9" cy="14" r="1.5" fill="currentColor" />
        <circle cx="15" cy="14" r="1.5" fill="currentColor" />
      </svg>
    </div>
    <div class="bubble-wrapper">
      <div class="bubble streaming" v-html="rendered" />
      <span class="typing-indicator">
        <span /><span /><span />
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;

.bubble-row {
  display: flex;
  gap: $space-3;
  margin-bottom: $space-4;
  align-items: flex-start;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: $radius-full;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bot-avatar {
  background: $primary-bg;
  color: $primary;

  svg { width: 20px; height: 20px; }
}

.bubble-wrapper {
  max-width: 70%;
}

.bubble {
  padding: $space-3 $space-4;
  border-radius: $radius-md;
  background: $bg-card;
  border: 1px solid $border-color;
  color: $text-primary;
  font-size: $font-base;
  line-height: $line-height-relaxed;

  &.streaming {
    border-color: $primary;
    border-style: dashed;
  }

  :deep(p) {
    margin: 0 0 $space-2;
    &:last-child { margin-bottom: 0; }
  }
}

.typing-indicator {
  display: inline-flex;
  gap: 4px;
  margin-top: $space-1;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $primary;
    animation: bounce 1.4s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
