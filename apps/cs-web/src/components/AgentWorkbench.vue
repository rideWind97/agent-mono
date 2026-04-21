<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from "vue";
import { api } from "@/api";
import { useWebSocket } from "@/composables/useWebSocket";
import ChatBubble from "./ChatBubble.vue";
import type { Session, Message } from "@/types";

const sessions = ref<Session[]>([]);
const activeSessionId = ref("");
const replyInput = ref("");
const chatContainer = ref<HTMLElement>();
const ws = useWebSocket();

const activeSession = computed(() =>
  sessions.value.find((s) => s.id === activeSessionId.value),
);

const pendingSessions = computed(() =>
  sessions.value.filter((s) => s.status === "human"),
);

async function loadSessions() {
  try {
    const { sessions: list } = await api.listSessions("human");
    sessions.value = list || [];
  } catch {
    // ignore
  }
}

function selectSession(id: string) {
  activeSessionId.value = id;
  ws.disconnect();
  ws.connect("/ws/agent", id);
  ws.send({ type: "agent_join", sessionId: id });

  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

function sendReply() {
  const text = replyInput.value.trim();
  if (!text || !activeSessionId.value) return;

  ws.send({
    type: "agent_message",
    sessionId: activeSessionId.value,
    content: text,
  });

  const session = activeSession.value;
  if (session) {
    session.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: text,
      timestamp: new Date().toISOString(),
    });
  }

  replyInput.value = "";
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

async function transferBackToAI() {
  if (!activeSessionId.value) return;
  try {
    await api.transferToAI(activeSessionId.value);
    const session = activeSession.value;
    if (session) {
      session.status = "ai";
    }
    activeSessionId.value = "";
    ws.disconnect();
    await loadSessions();
  } catch {
    // ignore
  }
}

ws.onMessage((msg) => {
  if (msg.type === "customer_message" && msg.sessionId === activeSessionId.value) {
    const session = activeSession.value;
    if (session) {
      session.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content: msg.content || "",
        timestamp: new Date().toISOString(),
      });
      nextTick(() => {
        if (chatContainer.value) {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
      });
    }
  } else if (msg.type === "transfer_request") {
    loadSessions();
  }
});

watch(activeSession, () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
});

onMounted(() => {
  loadSessions();
  const interval = setInterval(loadSessions, 5000);
  return () => clearInterval(interval);
});
</script>

<template>
  <div class="workbench">
    <aside class="session-list">
      <div class="list-header">
        <h2>待处理会话</h2>
        <span class="badge">{{ pendingSessions.length }}</span>
      </div>
      <div class="list-body">
        <div v-if="pendingSessions.length === 0" class="empty-state">
          暂无待处理会话
        </div>
        <button
          v-for="session in pendingSessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === activeSessionId }"
          @click="selectSession(session.id)"
        >
          <div class="session-info">
            <span class="session-id">{{ session.id.slice(0, 8) }}...</span>
            <span v-if="session.intent" class="intent-label">{{ session.intent }}</span>
          </div>
          <span class="msg-count">{{ session.messages?.length || 0 }} 条消息</span>
        </button>
      </div>
      <button class="refresh-btn" @click="loadSessions">刷新列表</button>
    </aside>

    <main class="chat-area">
      <template v-if="activeSession">
        <header class="chat-header">
          <div>
            <h3>会话 {{ activeSessionId.slice(0, 8) }}</h3>
            <span v-if="activeSession.intent" class="intent-tag">
              意图: {{ activeSession.intent }}
            </span>
          </div>
          <button class="transfer-btn" @click="transferBackToAI">转回 AI</button>
        </header>

        <div ref="chatContainer" class="messages">
          <ChatBubble
            v-for="msg in activeSession.messages"
            :key="msg.id"
            :message="msg"
          />
        </div>

        <div class="reply-area">
          <textarea
            v-model="replyInput"
            placeholder="输入回复..."
            rows="2"
            @keydown.enter.exact.prevent="sendReply"
          />
          <button class="send-btn" :disabled="!replyInput.trim()" @click="sendReply">
            发送
          </button>
        </div>
      </template>

      <div v-else class="no-selection">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        </svg>
        <p>选择一个会话开始回复</p>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.workbench {
  display: flex;
  height: 100%;
  background: $bg-body;
}

.session-list {
  width: 300px;
  background: $bg-card;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.list-header {
  @include flex-between;
  padding: $space-4 $space-5;
  border-bottom: 1px solid $border-color;

  h2 {
    font-size: $font-md;
    font-weight: $font-weight-semibold;
  }
}

.badge {
  background: $primary;
  color: white;
  font-size: $font-xs;
  padding: 2px 8px;
  border-radius: $radius-full;
  font-weight: $font-weight-semibold;
}

.list-body {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  padding: $space-8;
  text-align: center;
  color: $text-muted;
  font-size: $font-sm;
}

.session-item {
  @include btn-reset;
  width: 100%;
  text-align: left;
  padding: $space-3 $space-5;
  border-bottom: 1px solid $border-light;
  transition: background $transition-fast;

  &:hover { background: $gray-50; }
  &.active { background: $primary-light; border-left: 3px solid $primary; }
}

.session-info {
  display: flex;
  align-items: center;
  gap: $space-2;
  margin-bottom: $space-1;
}

.session-id {
  font-size: $font-sm;
  font-weight: $font-weight-medium;
  color: $text-primary;
  font-family: $font-mono;
}

.intent-label {
  font-size: $font-xs;
  padding: 1px 6px;
  border-radius: $radius-xs;
  background: $warning-bg;
  color: $warning;
}

.msg-count {
  font-size: $font-xs;
  color: $text-muted;
}

.refresh-btn {
  @include btn-secondary;
  margin: $space-3;
  justify-content: center;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  @include flex-between;
  padding: $space-4 $space-5;
  background: $bg-card;
  border-bottom: 1px solid $border-color;

  h3 {
    font-size: $font-md;
    font-weight: $font-weight-semibold;
    font-family: $font-mono;
  }
}

.intent-tag {
  font-size: $font-xs;
  color: $text-secondary;
}

.transfer-btn {
  @include btn-base;
  padding: $space-2 $space-3;
  background: $warning-bg;
  color: $warning;
  font-size: $font-sm;
  border: 1px solid rgba($warning, 0.3);

  &:hover:not(:disabled) {
    background: $warning;
    color: white;
  }
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: $space-5;
  max-width: 860px;
  width: 100%;
}

.reply-area {
  display: flex;
  gap: $space-3;
  padding: $space-4;
  background: $bg-card;
  border-top: 1px solid $border-color;
  align-items: flex-end;

  textarea {
    @include input-base;
    resize: none;
    min-height: 44px;
    max-height: 100px;
  }

  .send-btn {
    @include btn-primary;
    flex-shrink: 0;
    height: 44px;
    padding: 0 $space-5;
  }
}

.no-selection {
  flex: 1;
  @include flex-center;
  flex-direction: column;
  gap: $space-4;
  color: $text-muted;

  svg { width: 48px; height: 48px; }
  p { font-size: $font-md; }
}
</style>
