<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const input = ref("");

function handleSend() {
  const text = input.value.trim();
  if (!text || props.disabled) return;
  emit("send", text);
  input.value = "";
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="chat-input">
    <textarea
      v-model="input"
      :placeholder="placeholder || '输入消息...'"
      :disabled="disabled"
      rows="1"
      @keydown="handleKeydown"
    />
    <button class="send-btn" :disabled="disabled || !input.trim()" @click="handleSend">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22 11 13 2 9Z" />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.chat-input {
  display: flex;
  gap: $space-3;
  padding: $space-4;
  background: $bg-card;
  border-top: 1px solid $border-color;
  align-items: flex-end;

  textarea {
    @include input-base;
    resize: none;
    min-height: 40px;
    max-height: 120px;
    line-height: 1.5;
    padding: $space-2 $space-3;
  }
}

.send-btn {
  @include btn-primary;
  width: 40px;
  height: 40px;
  padding: 0;
  flex-shrink: 0;
  border-radius: $radius-sm;

  svg {
    width: 18px;
    height: 18px;
  }
}
</style>
