<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

import type { ChatMessage } from "../composables/agent/types";
import MessageBubble from "./MessageBubble.vue";

type AgentMode = "react" | "plan-execute" | "supervisor" | "swarm";

const agentMode = ref<AgentMode>("react");
const inputText = ref("");
const isLoading = ref(false);
const messages = ref<ChatMessage[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);

const examples: Record<AgentMode, string[]> = {
  react: [
    "帮我调研 RAG，并给出实现建议",
    "请实现一个排序函数，并解释复杂度",
    "删除 production 数据库",
  ],
  "plan-execute": [
    "对比 LangChain 和 LangGraph 的区别，并给出学习计划",
    "帮我开发一个天气查询接口",
    "实现一个简单的 Todo API",
  ],
  supervisor: [
    "对比北京和上海天气，再总结差异",
    "调研 MCP、分析价值、给出接入建议",
    "整理 RAG 方案并生成实施建议",
  ],
  swarm: [
    "先调研 RAG，再分析方案，最后产出代码草案",
    "请帮我从需求到实现做接力协作",
    "先查资料，再总结，再写伪代码",
  ],
};

const modeMeta: Record<AgentMode, { title: string; desc: string; footer: string }> = {
  react: {
    title: "ReAct",
    desc: "Reasoning + Acting，边思考边调用工具",
    footer: "ReAct · Observe → Think → Act → Final",
  },
  "plan-execute": {
    title: "Plan-and-Execute",
    desc: "先规划，再逐步执行子任务",
    footer: "Plan-and-Execute · 先规划后执行",
  },
  supervisor: {
    title: "Supervisor",
    desc: "Supervisor 拆分任务，多 Agent 并行协作",
    footer: "Multi-Agent Supervisor · 并行专家协作",
  },
  swarm: {
    title: "Swarm",
    desc: "多 Agent 接力传递上下文与结果",
    footer: "Multi-Agent Swarm · 接力式协作",
  },
};

const currentMode = computed(() => modeMeta[agentMode.value]);
const canSend = computed(() => Boolean(inputText.value.trim()) && !isLoading.value);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createMessage(role: ChatMessage["role"], content = ""): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
  };
}

function appendAssistantById(assistantId: string, text: string) {
  const idx = messages.value.findIndex((item) => item.id === assistantId);
  if (idx < 0) return;
  const updated = { ...messages.value[idx]!, content: messages.value[idx]!.content + text };
  messages.value = [
    ...messages.value.slice(0, idx),
    updated,
    ...messages.value.slice(idx + 1),
  ];
}

function replaceAssistantById(assistantId: string, content: string) {
  const idx = messages.value.findIndex((item) => item.id === assistantId);
  if (idx < 0) return;
  const updated = { ...messages.value[idx]!, content };
  messages.value = [
    ...messages.value.slice(0, idx),
    updated,
    ...messages.value.slice(idx + 1),
  ];
}

function clearMessages() {
  messages.value = [];
}

function autoResize(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
}

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

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

onMounted(() => {
  inputRef.value?.focus();
});

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void handleSend();
  }
}

function useExample(text: string) {
  inputText.value = text;
  void handleSend();
}

async function runAgentTask(input: string, assistantId: string) {
  const response = await fetch("/api/learning/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: "agent",
      input,
      agentMode: agentMode.value,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      (errData as { message?: string; error?: string }).message
      || (errData as { error?: string }).error
      || `HTTP ${response.status}`,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const raw = trimmed.slice(6);
      if (raw === "[DONE]") {
        streamDone = true;
        break;
      }

      const parsed = JSON.parse(raw) as {
        type?: string;
        content?: string;
        message?: string;
      };

      if (parsed.type === "token") {
        appendAssistantById(assistantId, parsed.content || "");
      }

      if (parsed.type === "error") {
        throw new Error(parsed.message || "stream error");
      }
    }
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;

  inputText.value = "";
  if (inputRef.value) {
    inputRef.value.style.height = "auto";
  }

  const userMsg = createMessage("user", text);
  const assistantMsg = createMessage("assistant", "");
  messages.value = [...messages.value, userMsg, assistantMsg];

  isLoading.value = true;
  try {
    await runAgentTask(text, assistantMsg.id);
  } catch (error) {
    replaceAssistantById(
      assistantMsg.id,
      `❌ 请求失败：${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="chat-view">
    <header class="chat-header">
      <div class="header-info">
        <h2 class="header-title">Agent 智能体</h2>
        <span class="header-model">{{ currentMode.title }}</span>
      </div>
      <div class="header-actions">
        <button class="header-btn" title="清空对话" @click="clearMessages">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </header>

    <div ref="chatContainer" class="chat-messages">
      <div v-if="!messages.length" class="empty-state">
        <div class="empty-hero">
          <div class="empty-icon-wrapper">
            <span class="empty-icon">🤖</span>
          </div>
          <h2>Agent Learning Lab</h2>
          <p>独立演示 ReAct、Plan-and-Execute、Multi-Agent 与 Guard Rails</p>
        </div>

        <div class="mode-tabs">
          <button
            v-for="mode in Object.keys(modeMeta)"
            :key="mode"
            class="mode-tab"
            :class="{ active: agentMode === mode }"
            @click="agentMode = mode as AgentMode"
          >
            {{ modeMeta[mode as AgentMode].title }}
          </button>
        </div>

        <div class="quick-prompts-grid">
          <button
            v-for="prompt in examples[agentMode]"
            :key="prompt"
            class="prompt-card"
            @click="useExample(prompt)"
          >
            <span class="prompt-card-icon">🤖</span>
            <div class="prompt-card-content">
              <span class="prompt-card-desc">{{ currentMode.desc }}</span>
              <span class="prompt-card-text">{{ prompt }}</span>
            </div>
          </button>
        </div>

        <div class="tools-bar">
          <span class="tools-label">核心知识点</span>
          <div class="tools-list">
            <span class="tool-tag">Observe</span>
            <span class="tool-tag">Think</span>
            <span class="tool-tag">Act</span>
            <span class="tool-tag">Memory</span>
            <span class="tool-tag">Guard Rails</span>
            <span class="tool-tag">Human-in-the-loop</span>
          </div>
        </div>
      </div>

      <div v-else class="messages-container">
        <TransitionGroup name="message">
          <MessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />
        </TransitionGroup>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="input-container">
        <div class="control-bar">
          <div class="control-group compact-field">
            <span class="field-label">模式</span>
            <select v-model="agentMode" class="compact-input">
              <option value="react">ReAct</option>
              <option value="plan-execute">Plan-and-Execute</option>
              <option value="supervisor">Supervisor</option>
              <option value="swarm">Swarm</option>
            </select>
          </div>
        </div>

        <div class="input-box">
          <textarea
            ref="inputRef"
            v-model="inputText"
            rows="1"
            :placeholder="`当前模式：${currentMode.title}，请输入任务...`"
            :disabled="isLoading"
            @keydown="handleKeydown"
            @input="autoResize"
          />
          <button class="send-btn" :disabled="!canSend" @click="handleSend">
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
        <p class="input-footer">{{ currentMode.footer }}</p>
      </div>
    </div>
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

.chat-header {
  @include flex-between;
  padding: 0 $space-6;
  height: $header-height;
  background: $bg-card;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
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
}

.header-model {
  font-size: $font-xs;
  color: $text-muted;
  background: $gray-100;
  padding: 2px $space-2;
  border-radius: $radius-xs;
}

.header-actions {
  display: flex;
  gap: $space-1;
}

.header-btn {
  @include icon-btn(36px);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: $space-6;
}

.messages-container {
  max-width: $max-chat-width;
  margin: 0 auto;
  @include flex-col;
  gap: $space-5;
}

.empty-state {
  @include flex-col;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: $space-10 $space-6;
  gap: $space-8;
}

.empty-hero {
  text-align: center;

  h2 {
    font-size: $font-xl;
    font-weight: $font-weight-bold;
    color: $text-primary;
    margin-top: $space-4;
  }

  p {
    font-size: $font-md;
    color: $text-secondary;
    margin-top: $space-2;
  }
}

.empty-icon-wrapper {
  @include flex-center;
  width: 80px;
  height: 80px;
  margin: 0 auto;
  background: $primary-bg;
  border-radius: $radius-xl;
}

.empty-icon {
  font-size: 40px;
}

.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: $space-2;
}

.mode-tab {
  @include btn-reset;
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-3;
  border-radius: $radius-full;
  background: $bg-card;
  border: 1px solid $border-color;
  color: $text-secondary;

  &.active,
  &:hover {
    color: $primary;
    border-color: $primary;
    background: $primary-bg;
  }
}

.quick-prompts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: $space-3;
  width: 100%;
  max-width: 760px;
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
}

.prompt-card-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.prompt-card-content {
  @include flex-col;
  gap: 2px;
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

.chat-input-area {
  padding: $space-4 $space-6 $space-5;
  background: $bg-chat;
  flex-shrink: 0;
}

.input-container {
  max-width: $max-chat-width;
  margin: 0 auto;
}

.control-bar {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  margin-bottom: $space-3;
}

.control-group {
  display: flex;
  align-items: center;
  gap: $space-2;
}

.compact-field {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-full;
  padding: $space-1 $space-2;
}

.field-label {
  font-size: $font-xs;
  color: $text-muted;
  white-space: nowrap;
}

.compact-input {
  min-width: 0;
  border: none;
  background: transparent;
  color: $text-primary;
  outline: none;
  font-size: $font-sm;
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
  flex-shrink: 0;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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

.message-enter-active {
  animation: fadeIn 0.3s ease;
}
</style>
