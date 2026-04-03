<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

import type { ChatMessage } from "../composables/agent/types";
import MessageBubble from "./MessageBubble.vue";

type Tone = "简洁" | "专业" | "口语化";
type TaskKey = "memory" | "lcel" | "workflow" | "functionCall" | "rag" | "intent";

interface TaskOption {
  key: TaskKey;
  icon: string;
  title: string;
  desc: string;
  placeholder: string;
  footer: string;
}

const taskOptions: TaskOption[] = [
  {
    key: "memory",
    icon: "🧠",
    title: "记忆对话",
    desc: "SSE 流式返回，同 sessionId 复用上下文",
    placeholder: "输入要让模型记住的信息，按 Enter 发送...",
    footer: "SSE 流式对话 · 可复用历史上下文",
  },
  {
    key: "lcel",
    icon: "⛓️",
    title: "LCEL 链",
    desc: "Prompt → LLM → OutputParser",
    placeholder: "输入一个主题，例如 RAG、Agent、Function Calling...",
    footer: "LCEL 学习案例 · 前端逐字流式展示",
  },
  {
    key: "workflow",
    icon: "🧭",
    title: "LangGraph 工作流",
    desc: "多步骤 classify → solve/general → finalize",
    placeholder: "输入数学题或知识问题，观察多步骤工作流...",
    footer: "LangGraph 工作流 · 前端逐字流式展示",
  },
  {
    key: "functionCall",
    icon: "🛠️",
    title: "Function Call",
    desc: "并行工具调用与工具结果整合",
    placeholder: "例如：帮我对比北京和上海今天的天气，再告诉我两地时间...",
    footer: "Function Calling · 多工具协作演示",
  },
  {
    key: "rag",
    icon: "📚",
    title: "RAG Demo",
    desc: "查询扩展 + 检索 + 重排 + 评估",
    placeholder: "例如：RAG 的评估和优化该怎么做？",
    footer: "RAG Demo · 检索结果逐字输出",
  },
  {
    key: "intent",
    icon: "🎯",
    title: "意图识别",
    desc: "纯 SDK 实现，多轮槽位补全",
    placeholder: "例如：提醒我下午 3 点开会",
    footer: "Intent Demo · 多轮槽位补全",
  },
];

const examples: Record<TaskKey, string[]> = {
  memory: ["我叫小陈，请记住我的名字。", "我喜欢 TypeScript。", "你还记得我说了什么吗？"],
  lcel: ["RAG", "Function Calling", "多 Agent 协作"],
  workflow: ["(12 + 8) * 3", "什么是多模态模型？", "1024 / (2 * 8)"],
  functionCall: [
    "帮我对比北京和上海今天的天气，再告诉我两地当前时间，并给穿衣建议。",
    "查一下广州和深圳天气，并给出通勤建议。",
    "对比杭州和成都今天天气，温差大吗？",
  ],
  rag: [
    "RAG 的评估和优化该怎么做？",
    "为什么 RAG 需要 query expansion 和 reranking？",
    "RAG 怎么降低幻觉并提升相关性？",
  ],
  intent: [
    "今天北京天气怎么样？",
    "帮我把你好翻译成英文",
    "提醒我下午3点开会",
    "你好",
    "明天上海会下雨吗？",
  ],
};

const messages = ref<ChatMessage[]>([]);
const isLoading = ref(false);
const selectedTask = ref<TaskKey>("memory");
const inputText = ref("");
const chatContainer = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const memorySessionId = ref("demo-session-1");
const lcelTone = ref<Tone>("简洁");
const intentSessionId = ref<string | null>(null);

const currentTask = computed(
  () => taskOptions.find((task) => task.key === selectedTask.value) || taskOptions[0],
);

const canSend = computed(() => Boolean(inputText.value.trim()) && !isLoading.value);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clearMessages() {
  messages.value = [];
  intentSessionId.value = null;
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

watch(selectedTask, (task) => {
  if (task !== "intent") {
    intentSessionId.value = null;
  }
});

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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamTextToAssistant(assistantId: string, text: string) {
  if (!text) return;
  replaceAssistantById(assistantId, "");
  const chunkSize = text.length > 1200 ? 24 : 12;
  for (let i = 0; i < text.length; i += chunkSize) {
    appendAssistantById(assistantId, text.slice(i, i + chunkSize));
    await sleep(16);
  }
}

async function runMemoryTask(input: string, assistantId: string) {
  const response = await fetch("/api/learning/memory-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: memorySessionId.value.trim(),
      input,
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
  let sessionId = memorySessionId.value.trim();
  let historyCount = 0;

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
        sessionId?: string;
        historyCount?: number;
        message?: string;
      };

      if (parsed.type === "token") {
        appendAssistantById(assistantId, parsed.content || "");
      }

      if (parsed.type === "meta") {
        sessionId = parsed.sessionId || sessionId;
        historyCount = parsed.historyCount ?? historyCount;
      }

      if (parsed.type === "error") {
        throw new Error(parsed.message || "stream error");
      }
    }
  }

  appendAssistantById(
    assistantId,
    `\n\n---\n会话 ID：\`${sessionId}\`\n历史消息数：\`${historyCount}\``,
  );
}

async function runIntentTask(input: string, assistantId: string) {
  const response = await fetch("/api/intent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input,
      sessionId: intentSessionId.value,
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
        status?: string;
        sessionId?: string;
      };

      if (parsed.type === "token") {
        appendAssistantById(assistantId, parsed.content || "");
      }

      if (parsed.type === "meta") {
        if (parsed.status === "need_more_info") {
          intentSessionId.value = parsed.sessionId || null;
        } else {
          intentSessionId.value = null;
        }
      }

      if (parsed.type === "error") {
        throw new Error(parsed.message || "stream error");
      }
    }
  }
}

async function runLearningStreamTask(
  task: "lcel" | "workflow" | "functionCall" | "rag",
  input: string,
  assistantId: string,
) {
  const body: Record<string, unknown> = { task, input };
  if (task === "lcel") body.tone = lcelTone.value;

  const response = await fetch("/api/learning/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

async function runSelectedTask(input: string, assistantId: string) {
  if (selectedTask.value === "memory") {
    await runMemoryTask(input, assistantId);
    return;
  }

  if (selectedTask.value === "lcel") {
    await runLearningStreamTask("lcel", input, assistantId);
    return;
  }

  if (selectedTask.value === "workflow") {
    await runLearningStreamTask("workflow", input, assistantId);
    return;
  }

  if (selectedTask.value === "functionCall") {
    await runLearningStreamTask("functionCall", input, assistantId);
    return;
  }

  if (selectedTask.value === "rag") {
    await runLearningStreamTask("rag", input, assistantId);
    return;
  }

  await runIntentTask(input, assistantId);
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
    await runSelectedTask(text, assistantMsg.id);
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
  <div class="chat-view learning-view">
    <header class="chat-header">
      <div class="header-info">
        <h2 class="header-title">学习页</h2>
        <span class="header-model">{{ currentTask.icon }} {{ currentTask.title }}</span>
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
          <h2>LangChain Learning Lab</h2>
          <p>统一聊天界面，支持真实流式输出与多任务学习演示</p>
        </div>

        <div class="task-tabs">
          <button
            v-for="task in taskOptions"
            :key="task.key"
            class="task-tab"
            :class="{ active: selectedTask === task.key }"
            @click="selectedTask = task.key"
          >
            <span>{{ task.icon }}</span>
            <span>{{ task.title }}</span>
          </button>
        </div>

        <div class="quick-prompts-grid">
          <button
            v-for="prompt in examples[selectedTask]"
            :key="prompt"
            class="prompt-card"
            @click="useExample(prompt)"
          >
            <span class="prompt-card-icon">{{ currentTask.icon }}</span>
            <div class="prompt-card-content">
              <span class="prompt-card-desc">{{ currentTask.desc }}</span>
              <span class="prompt-card-text">{{ prompt }}</span>
            </div>
          </button>
        </div>

        <div class="tools-bar">
          <span class="tools-label">学习任务</span>
          <div class="tools-list">
            <span class="tool-tag">🧠 Memory</span>
            <span class="tool-tag">⛓️ LCEL</span>
            <span class="tool-tag">🧭 Workflow</span>
            <span class="tool-tag">🛠️ Function Call</span>
            <span class="tool-tag">📚 RAG</span>
            <span class="tool-tag">🎯 Intent</span>
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
          <div class="control-group task-switcher">
            <button
              v-for="task in taskOptions"
              :key="task.key"
              class="mini-task-btn"
              :class="{ active: selectedTask === task.key }"
              @click="selectedTask = task.key"
            >
              {{ task.icon }} {{ task.title }}
            </button>
          </div>

          <div v-if="selectedTask === 'memory'" class="control-group compact-field">
            <span class="field-label">Session</span>
            <input
              v-model="memorySessionId"
              class="compact-input"
              placeholder="demo-session-1"
            />
          </div>

          <div v-if="selectedTask === 'lcel'" class="control-group compact-field">
            <span class="field-label">语气</span>
            <select v-model="lcelTone" class="compact-input">
              <option value="简洁">简洁</option>
              <option value="专业">专业</option>
              <option value="口语化">口语化</option>
            </select>
          </div>

          <div v-if="selectedTask === 'intent' && intentSessionId" class="control-group status-chip">
            多轮补全中：{{ intentSessionId }}
          </div>
        </div>

        <div class="input-box">
          <textarea
            ref="inputRef"
            v-model="inputText"
            rows="1"
            :placeholder="currentTask.placeholder"
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
        <p class="input-footer">{{ currentTask.footer }}</p>
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

  @include mobile {
    padding: $space-3;
  }
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

.task-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: $space-2;
  max-width: 860px;
}

.task-tab {
  @include btn-reset;
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-3;
  border-radius: $radius-full;
  background: $bg-card;
  border: 1px solid $border-color;
  color: $text-secondary;
  transition: all $transition-base;

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

  @include mobile {
    grid-template-columns: 1fr;
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
}

.prompt-card-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;
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

  @include mobile {
    padding: $space-3;
  }
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

.task-switcher {
  flex: 1;
  min-width: 100%;
  overflow-x: auto;
  padding-bottom: 2px;
}

.mini-task-btn {
  @include btn-reset;
  white-space: nowrap;
  padding: $space-2 $space-3;
  border-radius: $radius-full;
  border: 1px solid $border-color;
  background: $bg-card;
  color: $text-secondary;

  &.active {
    border-color: $primary;
    color: $primary;
    background: $primary-bg;
  }
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

.status-chip {
  font-size: $font-xs;
  color: $primary;
  background: $primary-bg;
  border: 1px solid $primary-light;
  border-radius: $radius-full;
  padding: $space-2 $space-3;
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
