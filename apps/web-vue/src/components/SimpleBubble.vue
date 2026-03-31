<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";

import type { SimpleChatMessage } from "../composables/useChat";

const props = defineProps<{
  message: SimpleChatMessage;
}>();

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

const renderedContent = computed(() => {
  if (!props.message.content) return "";
  return md.render(props.message.content);
});

const timeStr = computed(() => {
  const d = new Date(props.message.timestamp);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
});
</script>

<template>
  <div class="message-row" :class="message.role">
    <div class="message-inner">
      <!-- Avatar -->
      <div class="avatar">
        <span v-if="message.role === 'user'" class="avatar-icon user-icon">U</span>
        <span v-else class="avatar-icon ai-icon">AI</span>
      </div>

      <!-- Content -->
      <div class="content-area">
        <div class="role-label">{{ message.role === "user" ? "你" : "AI 助手" }}</div>

        <!-- Message content -->
        <div v-if="message.content" class="content-body" v-html="renderedContent" />

        <!-- Loading indicator -->
        <div v-if="message.role === 'assistant' && !message.content" class="thinking">
          <div class="thinking-dots">
            <span /><span /><span />
          </div>
          <span class="thinking-text">思考中...</span>
        </div>

        <span class="time">{{ timeStr }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.message-row {
  width: 100%;
  padding: $space-4 0;
  animation: msgFadeIn 0.35s ease;

  &.assistant {
    background: transparent;
  }

  &.user {
    background: rgba($primary, 0.02);
  }

  & + & {
    border-top: 1px solid $border-light;
  }
}

.message-inner {
  display: flex;
  gap: $space-4;
  max-width: $max-chat-width;
  margin: 0 auto;
  padding: 0 $space-5;

  @include mobile {
    padding: 0 $space-3;
    gap: $space-3;
  }
}

.avatar {
  flex-shrink: 0;
  padding-top: 2px;
}

.avatar-icon {
  @include flex-center;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  font-size: $font-sm;
  font-weight: $font-weight-bold;
  letter-spacing: -0.5px;

  &.ai-icon {
    background: linear-gradient(135deg, $primary 0%, #818cf8 100%);
    color: $text-inverse;
  }

  &.user-icon {
    background: $gray-200;
    color: $gray-600;
  }
}

.content-area {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.role-label {
  font-size: $font-sm;
  font-weight: $font-weight-semibold;
  color: $text-primary;
  margin-bottom: $space-2;
}

.content-body {
  font-size: $font-base;
  line-height: $line-height-relaxed;
  color: $text-primary;
  word-break: break-word;

  // Markdown content styles
  :deep(p) {
    margin: 0;
  }

  :deep(p + p) {
    margin-top: $space-3;
  }

  :deep(strong) {
    font-weight: $font-weight-semibold;
  }

  :deep(code) {
    background: $gray-100;
    padding: 2px 6px;
    border-radius: $radius-xs;
    font-size: $font-sm;
    font-family: $font-mono;
    color: $error;
  }

  :deep(pre) {
    background: $gray-900;
    color: $gray-200;
    padding: $space-4;
    border-radius: $radius-sm;
    overflow-x: auto;
    margin: $space-3 0;
    font-size: $font-sm;
    line-height: 1.6;

    code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }
  }

  :deep(ul),
  :deep(ol) {
    padding-left: $space-6;
    margin: $space-3 0;
  }

  :deep(li) {
    margin: $space-1 0;
    line-height: $line-height-relaxed;
  }

  :deep(li + li) {
    margin-top: $space-2;
  }

  :deep(blockquote) {
    border-left: 3px solid $primary;
    padding: $space-2 $space-4;
    margin: $space-3 0;
    color: $text-secondary;
    background: $gray-50;
    border-radius: 0 $radius-xs $radius-xs 0;
  }

  :deep(a) {
    color: $primary;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: $space-4 0 $space-2;
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  :deep(h1) {
    font-size: $font-xl;
  }

  :deep(h2) {
    font-size: $font-lg;
  }

  :deep(h3) {
    font-size: $font-md;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid $border-color;
    margin: $space-4 0;
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: $space-3 0;
    font-size: $font-sm;
  }

  :deep(th),
  :deep(td) {
    border: 1px solid $border-color;
    padding: $space-2 $space-3;
    text-align: left;
  }

  :deep(th) {
    background: $gray-50;
    font-weight: $font-weight-semibold;
  }

  @include mobile {
    font-size: $font-sm;
  }
}

.time {
  display: inline-block;
  font-size: $font-xs;
  color: $text-muted;
  margin-top: $space-2;
}

// Thinking animation
.thinking {
  display: flex;
  align-items: center;
  gap: $space-2;
}

.thinking-dots {
  display: flex;
  gap: 4px;

  span {
    width: 6px;
    height: 6px;
    background: $gray-400;
    border-radius: $radius-full;
    animation: thinkBounce 1.4s infinite ease-in-out both;

    &:nth-child(1) {
      animation-delay: -0.32s;
    }

    &:nth-child(2) {
      animation-delay: -0.16s;
    }
  }
}

.thinking-text {
  font-size: $font-sm;
  color: $text-muted;
}

@keyframes msgFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes thinkBounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
