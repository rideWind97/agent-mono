<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from "vue";
import { useChat } from "@/composables/useChat";
import { useWebSocket } from "@/composables/useWebSocket";
import ChatBubble from "./ChatBubble.vue";
import ChatInput from "./ChatInput.vue";
import StreamingBubble from "./StreamingBubble.vue";

const {
  sessionId,
  messages,
  status,
  currentIntent,
  isLoading,
  streamingContent,
  isHuman,
  initSession,
  sendMessage,
  transferToHuman,
  reset,
} = useChat();

const ws = useWebSocket();
const chatContainer = ref<HTMLElement>();

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

watch(messages, scrollToBottom, { deep: true });
watch(streamingContent, scrollToBottom);

// Connect WebSocket when session enters human mode
watch(status, (val) => {
  if (val === "human" && sessionId.value) {
    ws.connect("/ws/customer", sessionId.value);
  }
});

ws.onMessage((msg) => {
  if (msg.type === "agent_message") {
    messages.value.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: msg.content || "",
      timestamp: new Date().toISOString(),
    });
  } else if (msg.type === "agent_joined") {
    messages.value.push({
      id: crypto.randomUUID(),
      role: "system",
      content: msg.content || "人工客服已接入",
      timestamp: new Date().toISOString(),
    });
  } else if (msg.type === "transfer_to_ai") {
    status.value = "ai";
    messages.value.push({
      id: crypto.randomUUID(),
      role: "system",
      content: msg.content || "已转回 AI 客服",
      timestamp: new Date().toISOString(),
    });
  }
});

function handleNewChat() {
  ws.disconnect();
  reset();
}

onMounted(() => initSession());
</script>

<template>
  <div class="customer-chat">
    <header class="chat-header">
      <div class="header-left">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
          </svg>
        </div>
        <div>
          <h1>智能客服</h1>
          <span class="status-tag" :class="status">
            {{ status === 'ai' ? 'AI 助手' : status === 'human' ? '人工服务' : '已结束' }}
          </span>
        </div>
      </div>
      <div class="header-actions">
        <button v-if="!isHuman" class="action-btn" @click="transferToHuman" title="转人工">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          转人工
        </button>
        <button class="action-btn secondary" @click="handleNewChat" title="新对话">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="currentIntent" class="intent-banner">
      识别意图: <strong>{{ currentIntent.name }}</strong>
      <span v-if="currentIntent.confidence">({{ (currentIntent.confidence * 100).toFixed(0) }}%)</span>
    </div>

    <div ref="chatContainer" class="chat-messages">
      <div v-if="messages.length === 0" class="welcome">
        <div class="welcome-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4Z" />
            <rect x="4" y="8" width="16" height="12" rx="2" />
            <circle cx="9" cy="14" r="1.5" fill="currentColor" />
            <circle cx="15" cy="14" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <h2>您好！有什么可以帮您？</h2>
        <p>我是智能客服助手，可以回答产品、订单、技术等问题。</p>
        <div class="quick-actions">
          <button @click="sendMessage('你们有什么产品？')">产品咨询</button>
          <button @click="sendMessage('查询订单状态')">订单查询</button>
          <button @click="sendMessage('我遇到了技术问题')">技术支持</button>
          <button @click="transferToHuman()">转人工客服</button>
        </div>
      </div>

      <ChatBubble v-for="msg in messages" :key="msg.id" :message="msg" />
      <StreamingBubble v-if="streamingContent" :content="streamingContent" />

      <div v-if="isLoading && !streamingContent" class="loading-dots">
        <span /><span /><span />
      </div>
    </div>

    <ChatInput
      :disabled="isLoading"
      :placeholder="isHuman ? '发送消息给人工客服...' : '输入您的问题...'"
      @send="sendMessage"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.customer-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $bg-chat;
}

.chat-header {
  @include flex-between;
  padding: $space-4 $space-5;
  background: $bg-card;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: $space-3;

  h1 {
    font-size: $font-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    line-height: 1.2;
  }
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: $radius-md;
  background: $primary;
  color: white;
  @include flex-center;

  svg { width: 22px; height: 22px; }
}

.status-tag {
  font-size: $font-xs;
  padding: 2px 8px;
  border-radius: $radius-full;
  font-weight: $font-weight-medium;

  &.ai {
    background: $success-bg;
    color: $success;
  }
  &.human {
    background: $info-bg;
    color: $info;
  }
  &.closed {
    background: $gray-100;
    color: $gray-500;
  }
}

.header-actions {
  display: flex;
  gap: $space-2;
}

.action-btn {
  @include btn-base;
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  padding: $space-2 $space-3;
  background: $primary;
  color: $text-inverse;
  font-size: $font-sm;
  border-radius: $radius-sm;

  svg { width: 16px; height: 16px; }

  &:hover:not(:disabled) {
    background: $primary-hover;
  }

  &.secondary {
    background: $gray-100;
    color: $text-secondary;

    &:hover:not(:disabled) {
      background: $gray-200;
      color: $text-primary;
    }
  }
}

.intent-banner {
  padding: $space-2 $space-5;
  background: $info-bg;
  color: $info;
  font-size: $font-sm;
  text-align: center;
  border-bottom: 1px solid rgba($info, 0.15);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: $space-5;
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
}

.welcome {
  text-align: center;
  padding: $space-12 $space-5;

  h2 {
    font-size: $font-xl;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: $space-4 0 $space-2;
  }

  p {
    color: $text-secondary;
    font-size: $font-md;
    margin-bottom: $space-6;
  }
}

.welcome-icon {
  width: 64px;
  height: 64px;
  border-radius: $radius-lg;
  background: $primary-bg;
  color: $primary;
  @include flex-center;
  margin: 0 auto;

  svg { width: 36px; height: 36px; }
}

.quick-actions {
  display: flex;
  gap: $space-3;
  justify-content: center;
  flex-wrap: wrap;

  button {
    @include btn-base;
    padding: $space-2 $space-4;
    background: $bg-card;
    border: 1px solid $border-color;
    color: $text-primary;
    font-size: $font-sm;
    border-radius: $radius-full;

    &:hover {
      border-color: $primary;
      color: $primary;
      background: $primary-light;
    }
  }
}

.loading-dots {
  display: flex;
  gap: 6px;
  padding: $space-4;
  justify-content: center;

  span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $gray-400;
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
