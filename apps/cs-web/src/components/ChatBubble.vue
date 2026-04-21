<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import type { Message } from "@/types";

const props = defineProps<{ message: Message }>();

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const isUser = computed(() => props.message.role === "user");
const isSystem = computed(() => props.message.role === "system");

const rendered = computed(() =>
  isUser.value ? props.message.content : md.render(props.message.content),
);

const timeStr = computed(() => {
  const d = new Date(props.message.timestamp);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
});
</script>

<template>
  <div class="bubble-row" :class="{ 'is-user': isUser, 'is-system': isSystem }">
    <div v-if="!isUser" class="avatar bot-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4Z" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <circle cx="9" cy="14" r="1.5" fill="currentColor" />
        <circle cx="15" cy="14" r="1.5" fill="currentColor" />
      </svg>
    </div>
    <div class="bubble-wrapper">
      <div v-if="isSystem" class="system-msg">{{ message.content }}</div>
      <div v-else class="bubble" :class="{ user: isUser }" v-html="rendered" />
      <span class="time">{{ timeStr }}</span>
    </div>
    <div v-if="isUser" class="avatar user-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
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

  &.is-user {
    flex-direction: row-reverse;
  }

  &.is-system {
    justify-content: center;
  }
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: $radius-full;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
  }
}

.bot-avatar {
  background: $primary-bg;
  color: $primary;
}

.user-avatar {
  background: $gray-200;
  color: $gray-600;
}

.bubble-wrapper {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}

.bubble {
  padding: $space-3 $space-4;
  border-radius: $radius-md;
  background: $bg-card;
  border: 1px solid $border-color;
  color: $text-primary;
  font-size: $font-base;
  line-height: $line-height-relaxed;
  word-break: break-word;

  &.user {
    background: $primary;
    color: $text-inverse;
    border-color: $primary;
  }

  :deep(p) {
    margin: 0 0 $space-2;
    &:last-child { margin-bottom: 0; }
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: $radius-xs;
    font-family: $font-mono;
    font-size: $font-sm;
  }

  &.user :deep(code) {
    background: rgba(255, 255, 255, 0.2);
  }

  :deep(pre) {
    background: $gray-800;
    color: $gray-100;
    padding: $space-3;
    border-radius: $radius-sm;
    overflow-x: auto;
    margin: $space-2 0;

    code {
      background: none;
      padding: 0;
      color: inherit;
    }
  }

  :deep(ul), :deep(ol) {
    padding-left: $space-5;
    margin: $space-2 0;
  }

  :deep(strong) {
    font-weight: $font-weight-semibold;
  }
}

.system-msg {
  background: $warning-bg;
  color: $warning;
  padding: $space-2 $space-4;
  border-radius: $radius-full;
  font-size: $font-sm;
  text-align: center;
}

.time {
  font-size: $font-xs;
  color: $text-muted;
  margin-top: $space-1;

  .is-user & {
    text-align: right;
  }
}
</style>
