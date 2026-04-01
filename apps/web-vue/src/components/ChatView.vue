<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from "vue";

import { useAgent } from "../composables/useAgent";
import MessageBubble from "./MessageBubble.vue";
import SettingsPanel from "./SettingsPanel.vue";

const {
  messages,
  isLoading,
  agentConfig,
  sendMessage,
  clearMessages,
  saveConfig,
  imagePreviews,
} = useAgent();

const inputText = ref("");
const chatContainer = ref<HTMLElement | null>(null);
const showSettings = ref(false);
const inputRef = ref<HTMLTextAreaElement | null>(null);

// Quick prompts
const quickPrompts = [
  { icon: "🌤️", text: "北京今天天气怎么样？", desc: "天气查询" },
  { icon: "🧮", text: "帮我计算 (123 + 456) * 7 / 3", desc: "数学计算" },
  { icon: "🕐", text: "现在几点了？", desc: "时间查询" },
  { icon: "🌐", text: "把「你好世界」翻译成英文和日文", desc: "多语言翻译" },
  { icon: "🌍", text: "对比一下北京和上海的天气", desc: "多工具协作" },
  { icon: "🔢", text: "计算圆周率的前10位，再告诉我现在的时间", desc: "多步推理" },
  { icon: "🎨", text: "把背景色设置为红色", desc: "设置背景色" },
  { icon: "📷", text: "请让我上传一张图片并展示在界面中", desc: "图片上传" },
];

async function handleSend() {
  const text = inputText.value;
  inputText.value = "";
  // Reset textarea height
  if (inputRef.value) {
    inputRef.value.style.height = "auto";
  }
  await sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleQuickPrompt(text: string) {
  inputText.value = text;
  handleSend();
}

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  target.style.height = Math.min(target.scrollHeight, 120) + "px";
}

// Auto scroll to bottom
watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    scrollToBottom();
  },
);

watch(
  () => messages.value[messages.value.length - 1]?.content,
  async () => {
    await nextTick();
    scrollToBottom();
  },
);

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

onMounted(() => {
  inputRef.value?.focus();
});
</script>

<template>
  <div class="chat-view">
    <!-- Header Bar -->
    <header class="chat-header">
      <div class="header-info">
        <h2 class="header-title">对话</h2>
        <span class="header-model">{{ agentConfig.model }}</span>
      </div>
      <div class="header-actions">
        <button class="header-btn" title="清空对话" @click="clearMessages">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <button class="header-btn" title="设置" @click="showSettings = true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Messages Area -->
    <div ref="chatContainer" class="chat-messages">
      <!-- Empty State -->
      <div v-if="!messages.length" class="empty-state">
        <div class="empty-hero">
          <div class="empty-icon-wrapper">
            <span class="empty-icon">🤖</span>
          </div>
          <h2>LangChain Agent 助手</h2>
          <p>基于 LangChain ReAct Agent，支持多工具调用与推理</p>
        </div>

        <div class="quick-prompts-grid">
          <button
            v-for="prompt in quickPrompts"
            :key="prompt.text"
            class="prompt-card"
            @click="handleQuickPrompt(prompt.text)"
          >
            <span class="prompt-card-icon">{{ prompt.icon }}</span>
            <div class="prompt-card-content">
              <span class="prompt-card-desc">{{ prompt.desc }}</span>
              <span class="prompt-card-text">{{ prompt.text }}</span>
            </div>
          </button>
        </div>

        <div class="tools-bar">
          <span class="tools-label">可用工具</span>
          <div class="tools-list">
            <span class="tool-tag">🌤️ 天气查询</span>
            <span class="tool-tag">🧮 计算器</span>
            <span class="tool-tag">🕐 当前时间</span>
            <span class="tool-tag">🌐 翻译</span>
            <span class="tool-tag">📷 图片上传</span>
          </div>
        </div>
      </div>

      <!-- Message List -->
      <div v-if="messages.length" class="messages-container">
        <TransitionGroup name="message">
          <MessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />
        </TransitionGroup>

        <div v-if="imagePreviews.length" class="image-previews">
          <div v-for="img in imagePreviews" :key="img.id" class="image-preview-card">
            <img :src="img.url" :alt="img.name" />
            <span class="image-name">{{ img.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="chat-input-area">
      <div class="input-container">
        <div class="input-box">
          <textarea
            ref="inputRef"
            v-model="inputText"
            rows="1"
            placeholder="输入你的问题，按 Enter 发送，Shift+Enter 换行..."
            :disabled="isLoading"
            @keydown="handleKeydown"
            @input="autoResize"
          />
          <button
            class="send-btn"
            :disabled="!inputText.trim() || isLoading"
            @click="handleSend"
          >
            <template v-if="isLoading">
              <span class="btn-spinner" />
            </template>
            <template v-else>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </template>
          </button>
        </div>
        <p class="input-footer">
          LangChain ReAct Agent · 模型: {{ agentConfig.model }}
        </p>
      </div>
    </div>

    <!-- Settings Panel -->
    <SettingsPanel
      v-if="showSettings"
      :config="agentConfig"
      @update:config="agentConfig = $event"
      @save="saveConfig"
      @close="showSettings = false"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.chat-view {
  @include flex-col;
  height: 100vh;
  background: $bg-chat;
  position: relative;
}

// ============================================
// Header
// ============================================
.chat-header {
  @include flex-between;
  padding: 0 $space-6;
  height: $header-height;
  background: $bg-card;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;

  @include mobile {
    padding: 0 $space-4;
    height: 52px;
  }
}

.header-info {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.header-title {
  font-size: $font-lg;
  font-weight: $font-weight-semibold;
  color: $text-primary;

  @include mobile {
    font-size: $font-md;
  }
}

.header-model {
  font-size: $font-xs;
  color: $text-muted;
  background: $gray-100;
  padding: 2px $space-2;
  border-radius: $radius-xs;
  font-family: $font-mono;
}

.header-actions {
  display: flex;
  gap: $space-1;
}

.header-btn {
  @include icon-btn(36px);
}

// ============================================
// Messages Area
// ============================================
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: $space-6;

  @include mobile {
    padding: $space-3;
  }
}

.messages-container {
  max-width: $max-chat-width;
  margin: 0 auto;
  @include flex-col;
  gap: $space-5;

  @include mobile {
    gap: $space-3;
  }
}

.image-previews {
  margin-top: $space-3;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: $space-3;
}

.image-preview-card {
  @include flex-col;
  gap: $space-2;
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: $space-2;

  img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: $radius-sm;
    border: 1px solid $border-light;
  }
}

.image-name {
  font-size: $font-xs;
  color: $text-secondary;
  @include line-clamp(1);
}

// ============================================
// Empty State
// ============================================
.empty-state {
  @include flex-col;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: $space-10 $space-6;
  gap: $space-8;

  @include mobile {
    padding: $space-6 $space-4;
    gap: $space-5;
  }
}

.empty-hero {
  text-align: center;

  h2 {
    font-size: $font-xl;
    font-weight: $font-weight-bold;
    color: $text-primary;
    margin-top: $space-4;

    @include mobile {
      font-size: $font-lg;
    }
  }

  p {
    font-size: $font-md;
    color: $text-secondary;
    margin-top: $space-2;

    @include mobile {
      font-size: $font-sm;
    }
  }
}

.empty-icon-wrapper {
  @include flex-center;
  width: 80px;
  height: 80px;
  margin: 0 auto;
  background: $primary-bg;
  border-radius: $radius-xl;

  @include mobile {
    width: 64px;
    height: 64px;
  }
}

.empty-icon {
  font-size: 40px;

  @include mobile {
    font-size: 32px;
  }
}

.quick-prompts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: $space-3;
  width: 100%;
  max-width: 680px;

  @include mobile {
    grid-template-columns: 1fr;
    gap: $space-2;
  }
}

.prompt-card {
  @include btn-reset;
  display: flex;
  align-items: flex-start;
  gap: $space-3;
  padding: $space-4;
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $transition-base;
  text-align: left;

  &:hover {
    border-color: $primary;
    box-shadow: $shadow-md;
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  @include mobile {
    padding: $space-3;
    gap: $space-2;
  }
}

.prompt-card-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;

  @include mobile {
    font-size: 20px;
  }
}

.prompt-card-content {
  @include flex-col;
  gap: 2px;
  min-width: 0;
}

.prompt-card-desc {
  font-size: $font-xs;
  color: $text-muted;
  font-weight: $font-weight-medium;
}

.prompt-card-text {
  font-size: $font-sm;
  color: $text-primary;
  line-height: $line-height-normal;
  @include line-clamp(2);
}

.tools-bar {
  display: flex;
  align-items: center;
  gap: $space-3;
  flex-wrap: wrap;
  justify-content: center;
}

.tools-label {
  font-size: $font-xs;
  color: $text-muted;
  white-space: nowrap;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
}

.tool-tag {
  font-size: $font-xs;
  color: $text-secondary;
  background: $bg-card;
  border: 1px solid $border-color;
  padding: $space-1 $space-3;
  border-radius: $radius-full;
}

// ============================================
// Input Area
// ============================================
.chat-input-area {
  padding: $space-4 $space-6 $space-5;
  background: $bg-chat;
  flex-shrink: 0;

  @include mobile {
    padding: $space-3 $space-3 $space-4;
  }
}

.input-container {
  max-width: $max-chat-width;
  margin: 0 auto;
}

.input-box {
  display: flex;
  align-items: flex-end;
  gap: $space-3;
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  padding: $space-3 $space-3 $space-3 $space-5;
  box-shadow: $shadow-sm;
  transition: all $transition-base;

  &:focus-within {
    border-color: $primary;
    box-shadow: $shadow-md, 0 0 0 3px $primary-light;
  }

  textarea {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    font-size: $font-base;
    line-height: $line-height-relaxed;
    color: $text-primary;
    background: transparent;
    min-height: 24px;
    max-height: 120px;
    padding: $space-1 0;
    font-family: inherit;

    &::placeholder {
      color: $text-muted;
    }

    &:disabled {
      opacity: 0.5;
    }
  }

  @include mobile {
    padding: $space-2 $space-2 $space-2 $space-3;
    border-radius: $radius-md;
    gap: $space-2;
  }
}

.send-btn {
  @include flex-center;
  width: 40px;
  height: 40px;
  border: none;
  background: $primary;
  color: $text-inverse;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: $primary-hover;
    box-shadow: $shadow-sm;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @include mobile {
    width: 36px;
    height: 36px;
  }
}

.btn-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: $radius-full;
  animation: spin 0.8s linear infinite;
}

.input-footer {
  font-size: $font-xs;
  color: $text-muted;
  text-align: center;
  margin-top: $space-2;
}

// ============================================
// Message Transition
// ============================================
.message-enter-active {
  animation: fadeIn 0.3s ease;
}
</style>
