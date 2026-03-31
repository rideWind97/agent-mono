<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";

import type { ChatMessage } from "../composables/useAgent";
import ToolCallCard from "./ToolCallCard.vue";

const props = defineProps<{
  message: ChatMessage;
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
  <div class="message" :class="message.role">
    <div class="avatar">
      {{ message.role === "user" ? "👤" : "🤖" }}
    </div>
    <div class="bubble-wrapper">
      <!-- Tool calls -->
      <ToolCallCard
        v-if="message.toolCalls && message.toolCalls.length"
        :events="message.toolCalls"
      />

      <!-- Message content -->
      <div v-if="message.content" class="bubble" v-html="renderedContent" />

      <!-- Loading indicator -->
      <div
        v-if="message.role === 'assistant' && !message.content && (!message.toolCalls || !message.toolCalls.length)"
        class="bubble loading"
      >
        <span class="dot" /><span class="dot" /><span class="dot" />
      </div>

      <span class="time">{{ timeStr }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.message {
  display: flex;
  gap: $space-3;
  padding: $space-1 0;
  max-width: 85%;
  animation: fadeIn 0.3s ease;

  &.user {
    flex-direction: row-reverse;
    margin-left: auto;
  }

  @include mobile {
    max-width: 95%;
    gap: $space-2;
  }
}

.avatar {
  @include flex-center;
  width: 38px;
  height: 38px;
  border-radius: $radius-full;
  font-size: 18px;
  background: $gray-100;
  flex-shrink: 0;
  border: 1px solid $border-light;

  .user & {
    background: $primary-bg;
  }

  @include mobile {
    width: 32px;
    height: 32px;
    font-size: 15px;
  }
}

.bubble-wrapper {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  min-width: 0;

  .user & {
    align-items: flex-end;
  }
}

.bubble {
  padding: $space-3 $space-4;
  border-radius: $radius-md;
  font-size: $font-base;
  line-height: $line-height-relaxed;
  word-break: break-word;

  .user & {
    background: $primary;
    color: $text-inverse;
    border-bottom-right-radius: $radius-xs;
  }

  .assistant & {
    background: $bg-card;
    border: 1px solid $border-color;
    border-bottom-left-radius: $radius-xs;
    color: $text-primary;
  }

  // Markdown content styles
  :deep(p) {
    margin: 0;
  }

  :deep(p + p) {
    margin-top: $space-2;
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 5px;
    border-radius: $radius-xs;
    font-size: $font-sm;
    font-family: $font-mono;
  }

  :deep(pre) {
    background: $gray-800;
    color: $gray-200;
    padding: $space-3 $space-4;
    border-radius: $radius-sm;
    overflow-x: auto;
    margin: $space-2 0;
    font-size: $font-sm;

    code {
      background: none;
      padding: 0;
      color: inherit;
    }
  }

  :deep(ul),
  :deep(ol) {
    padding-left: $space-5;
    margin: $space-2 0;
  }

  :deep(li) {
    margin: $space-1 0;
  }

  :deep(blockquote) {
    border-left: 3px solid $primary;
    padding-left: $space-3;
    margin: $space-2 0;
    color: $text-secondary;
  }

  :deep(a) {
    color: $info;
    text-decoration: underline;
  }

  .user & {
    :deep(code) {
      background: rgba(255, 255, 255, 0.15);
    }

    :deep(a) {
      color: rgba(255, 255, 255, 0.9);
    }
  }

  @include mobile {
    padding: $space-3;
    font-size: $font-sm;
  }
}

.time {
  font-size: $font-xs;
  color: $text-muted;
  padding: 0 $space-1;
}

// Loading dots
.loading {
  display: flex;
  gap: $space-1;
  padding: 14px $space-5;
}

.dot {
  width: 8px;
  height: 8px;
  background: $text-muted;
  border-radius: $radius-full;
  animation: bounce 1.4s infinite ease-in-out both;

  &:nth-child(1) {
    animation-delay: -0.32s;
  }

  &:nth-child(2) {
    animation-delay: -0.16s;
  }
}
</style>
