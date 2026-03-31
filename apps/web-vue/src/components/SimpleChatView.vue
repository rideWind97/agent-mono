<script setup lang="ts">
import { ref, nextTick, watch } from "vue";

import SimpleBubble from "./SimpleBubble.vue";
import { useChat } from "../composables/useChat";

const { messages, isLoading, chatConfig, sendMessage, clearMessages, saveConfig } =
  useChat();

const inputText = ref("");
const chatContainer = ref<HTMLElement | null>(null);
const showSettings = ref(false);

/* ------------------------------------------------------------------ */
/*  Auto-scroll                                                        */
/* ------------------------------------------------------------------ */
function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

watch(
  () => messages.value.length,
  () => scrollToBottom(),
);

watch(
  () => messages.value[messages.value.length - 1]?.content,
  () => scrollToBottom(),
);

/* ------------------------------------------------------------------ */
/*  Send                                                               */
/* ------------------------------------------------------------------ */
async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;
  inputText.value = "";
  await sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */
function handleSaveSettings() {
  saveConfig();
  showSettings.value = false;
}

/* ------------------------------------------------------------------ */
/*  Quick presets                                                       */
/* ------------------------------------------------------------------ */
const presets = [
  { label: "DeepSeek", model: "deepseek-chat", baseUrl: "https://api.deepseek.com" },
  { label: "OpenAI", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  { label: "智谱", model: "glm-4-flash", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { label: "Moonshot", model: "moonshot-v1-8k", baseUrl: "https://api.moonshot.cn/v1" },
];

function applyPreset(preset: (typeof presets)[number]) {
  chatConfig.value.model = preset.model;
  chatConfig.value.baseUrl = preset.baseUrl;
}
</script>

<template>
  <div class="simple-chat">
    <!-- Header -->
    <header class="chat-header">
      <div class="header-inner">
        <div class="header-left">
          <div class="logo">
            <span class="logo-icon">AI</span>
          </div>
          <div class="header-info">
            <h1 class="title">AI Chat</h1>
            <span class="model-tag">{{ chatConfig.model }}</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="header-btn" title="清空对话" @click="clearMessages">
            <span class="btn-icon">🗑️</span>
            <span class="btn-text">清空</span>
          </button>
          <button
            class="header-btn"
            :class="{ active: showSettings }"
            title="设置"
            @click="showSettings = !showSettings"
          >
            <span class="btn-icon">⚙️</span>
            <span class="btn-text">设置</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Settings Panel -->
    <Transition name="settings-slide">
      <div v-if="showSettings" class="settings-panel">
        <div class="settings-inner">
          <div class="settings-header">
            <h3 class="settings-title">模型配置</h3>
            <button class="settings-close" @click="showSettings = false">✕</button>
          </div>

          <!-- Presets -->
          <div class="presets">
            <button
              v-for="p in presets"
              :key="p.label"
              class="preset-chip"
              :class="{ active: chatConfig.baseUrl === p.baseUrl && chatConfig.model === p.model }"
              @click="applyPreset(p)"
            >
              {{ p.label }}
            </button>
          </div>

          <div class="settings-grid">
            <div class="field full">
              <label>API Key</label>
              <input
                v-model="chatConfig.apiKey"
                type="password"
                placeholder="sk-..."
              />
            </div>
            <div class="field full">
              <label>Base URL</label>
              <input v-model="chatConfig.baseUrl" placeholder="https://api.openai.com" />
            </div>
            <div class="field full">
              <label>Model</label>
              <input v-model="chatConfig.model" placeholder="gpt-4o-mini" />
            </div>
            <div class="field">
              <label>Temperature</label>
              <input v-model.number="chatConfig.temperature" type="number" min="0" max="2" step="0.1" />
            </div>
            <div class="field">
              <label>Max Tokens</label>
              <input v-model.number="chatConfig.maxTokens" type="number" min="100" max="8192" step="100" />
            </div>
          </div>
          <button class="save-btn" @click="handleSaveSettings">保存配置</button>
        </div>
      </div>
    </Transition>

    <!-- Messages -->
    <div ref="chatContainer" class="messages-area">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-logo">
          <span>AI</span>
        </div>
        <h2 class="empty-title">有什么可以帮你的？</h2>
        <p class="empty-desc">我是 AI 助手，可以帮你回答问题、写作、编程等</p>
        <div class="suggestions">
          <button
            v-for="s in [
              '你好，请介绍一下你自己',
              '帮我写一首关于春天的诗',
              '解释一下什么是量子计算',
              '用 JavaScript 写一个快速排序',
            ]"
            :key="s"
            class="suggestion-chip"
            @click="inputText = s"
          >
            <span class="suggestion-icon">💡</span>
            {{ s }}
          </button>
        </div>
      </div>

      <!-- Message list -->
      <SimpleBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
    </div>

    <!-- Input area -->
    <div class="input-area">
      <div class="input-inner">
        <div class="input-box" :class="{ focused: false }">
          <textarea
            v-model="inputText"
            :disabled="isLoading"
            placeholder="输入你的问题..."
            rows="1"
            @keydown="handleKeydown"
          />
          <div class="input-actions">
            <span v-if="isLoading" class="loading-indicator">
              <span class="loading-spinner" />
            </span>
            <button
              class="send-btn"
              :disabled="!inputText.trim() || isLoading"
              :class="{ ready: inputText.trim() && !isLoading }"
              @click="handleSend"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13V3L14 8L3 13Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <p class="input-hint">Enter 发送 · Shift + Enter 换行</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.simple-chat {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: $bg-card;
  overflow: hidden;
}

/* ============================================ */
/* Header                                        */
/* ============================================ */
.chat-header {
  flex-shrink: 0;
  background: $bg-card;
  border-bottom: 1px solid $border-light;
}

.header-inner {
  @include flex-between;
  max-width: $max-chat-width;
  margin: 0 auto;
  padding: $space-3 $space-5;

  @include mobile {
    padding: $space-3;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.logo {
  flex-shrink: 0;
}

.logo-icon {
  @include flex-center;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  background: linear-gradient(135deg, $primary 0%, #818cf8 100%);
  color: $text-inverse;
  font-size: $font-sm;
  font-weight: $font-weight-bold;
  letter-spacing: -0.5px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: $space-2;
}

.title {
  font-size: $font-md;
  font-weight: $font-weight-semibold;
  color: $text-primary;
  margin: 0;
}

.model-tag {
  font-size: $font-xs;
  color: $text-muted;
  background: $gray-100;
  padding: 2px 8px;
  border-radius: $radius-full;
}

.header-actions {
  display: flex;
  gap: $space-1;
}

.header-btn {
  @include btn-reset;
  display: flex;
  align-items: center;
  gap: $space-1;
  padding: $space-1 $space-3;
  border-radius: $radius-sm;
  font-size: $font-sm;
  color: $text-secondary;
  transition: all $transition-fast;

  &:hover {
    background: $gray-100;
    color: $text-primary;
  }

  &.active {
    background: $primary-bg;
    color: $primary;
  }

  .btn-icon {
    font-size: 14px;
  }

  .btn-text {
    @include mobile {
      display: none;
    }
  }
}

/* ============================================ */
/* Settings                                      */
/* ============================================ */
.settings-panel {
  flex-shrink: 0;
  border-bottom: 1px solid $border-light;
  background: $gray-50;
  overflow: hidden;
}

.settings-inner {
  max-width: $max-chat-width;
  margin: 0 auto;
  padding: $space-4 $space-5;

  @include mobile {
    padding: $space-3;
  }
}

.settings-header {
  @include flex-between;
  margin-bottom: $space-3;
}

.settings-title {
  font-size: $font-base;
  font-weight: $font-weight-semibold;
  color: $text-primary;
  margin: 0;
}

.settings-close {
  @include btn-reset;
  @include flex-center;
  width: 28px;
  height: 28px;
  border-radius: $radius-sm;
  color: $text-muted;
  font-size: $font-sm;

  &:hover {
    background: $gray-200;
    color: $text-primary;
  }
}

.presets {
  display: flex;
  gap: $space-2;
  margin-bottom: $space-4;
  flex-wrap: wrap;
}

.preset-chip {
  @include btn-reset;
  padding: $space-1 $space-3;
  font-size: $font-sm;
  border-radius: $radius-full;
  background: $bg-card;
  color: $text-secondary;
  border: 1px solid $border-color;
  transition: all $transition-fast;

  &.active {
    background: $primary;
    color: $text-inverse;
    border-color: $primary;
  }

  &:hover:not(.active) {
    border-color: $primary;
    color: $primary;
  }
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-3;

  @include mobile {
    grid-template-columns: 1fr;
  }
}

.field {
  &.full {
    grid-column: 1 / -1;
  }

  label {
    display: block;
    font-size: $font-sm;
    font-weight: $font-weight-medium;
    color: $text-secondary;
    margin-bottom: $space-1;
  }

  input {
    @include input-base;
    background: $bg-card;
    font-size: $font-sm;
  }
}

.save-btn {
  @include btn-reset;
  @include flex-center;
  width: 100%;
  margin-top: $space-4;
  padding: $space-2 $space-4;
  background: $primary;
  color: $text-inverse;
  border-radius: $radius-sm;
  font-size: $font-sm;
  font-weight: $font-weight-medium;
  transition: all $transition-fast;

  &:hover {
    background: $primary-hover;
  }
}

/* ============================================ */
/* Messages                                      */
/* ============================================ */
.messages-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;

  @include mobile {
    padding: 0;
  }
}

/* ============================================ */
/* Empty state                                   */
/* ============================================ */
.empty-state {
  @include flex-center;
  flex-direction: column;
  height: 100%;
  text-align: center;
  padding: $space-8;
}

.empty-logo {
  @include flex-center;
  width: 64px;
  height: 64px;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, $primary 0%, #818cf8 100%);
  color: $text-inverse;
  font-size: $font-xl;
  font-weight: $font-weight-bold;
  margin-bottom: $space-5;
  letter-spacing: -1px;
}

.empty-title {
  font-size: $font-xl;
  font-weight: $font-weight-semibold;
  color: $text-primary;
  margin: 0 0 $space-2;
}

.empty-desc {
  font-size: $font-base;
  color: $text-muted;
  margin: 0 0 $space-8;
}

.suggestions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $space-3;
  max-width: 560px;
  width: 100%;

  @include mobile {
    grid-template-columns: 1fr;
    gap: $space-2;
  }
}

.suggestion-chip {
  @include btn-reset;
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-3 $space-4;
  font-size: $font-sm;
  color: $text-secondary;
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  text-align: left;
  transition: all $transition-fast;
  line-height: $line-height-normal;

  &:hover {
    border-color: $primary;
    color: $primary;
    background: $primary-bg;
  }

  .suggestion-icon {
    flex-shrink: 0;
    font-size: 14px;
  }
}

/* ============================================ */
/* Input area                                    */
/* ============================================ */
.input-area {
  flex-shrink: 0;
  background: $bg-card;
  border-top: 1px solid $border-light;
}

.input-inner {
  max-width: $max-chat-width;
  margin: 0 auto;
  padding: $space-4 $space-5;

  @include mobile {
    padding: $space-3;
  }
}

.input-box {
  display: flex;
  align-items: flex-end;
  background: $gray-50;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: $space-3 $space-3 $space-3 $space-4;
  transition: all $transition-fast;

  &:focus-within {
    border-color: $primary;
    box-shadow: 0 0 0 3px rgba($primary, 0.08);
    background: $bg-card;
  }

  textarea {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: $font-base;
    font-family: $font-family;
    line-height: $line-height-relaxed;
    color: $text-primary;
    resize: none;
    min-height: 24px;
    max-height: 150px;

    &::placeholder {
      color: $text-muted;
    }

    &:disabled {
      opacity: 0.6;
    }
  }
}

.input-actions {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-shrink: 0;
  padding-bottom: 2px;
}

.loading-indicator {
  @include flex-center;
  width: 32px;
  height: 32px;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid $gray-200;
  border-top-color: $primary;
  border-radius: $radius-full;
  animation: spin 0.8s linear infinite;
}

.send-btn {
  @include flex-center;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  border: none;
  background: $gray-200;
  color: $gray-400;
  cursor: pointer;
  flex-shrink: 0;
  transition: all $transition-fast;

  &.ready {
    background: $primary;
    color: $text-inverse;

    &:hover {
      background: $primary-hover;
    }
  }

  &:disabled {
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.input-hint {
  font-size: $font-xs;
  color: $text-muted;
  text-align: center;
  margin: $space-2 0 0;
}

/* ============================================ */
/* Transitions                                   */
/* ============================================ */
.settings-slide-enter-active,
.settings-slide-leave-active {
  transition: all 0.25s ease;
  max-height: 500px;
}

.settings-slide-enter-from,
.settings-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
