<script setup lang="ts">
import { computed, ref } from "vue";

type Tone = "简洁" | "专业" | "口语化";
type TaskKey = "memory" | "lcel" | "workflow" | "functionCall" | "rag";

const loading = ref<null | TaskKey>(null);
const errorText = ref("");
const result = ref<unknown>(null);
const selectedTask = ref<TaskKey>("memory");

const memoryForm = ref({
  sessionId: "demo-session-1",
  input: "",
});
const lcelForm = ref<{ topic: string; tone: Tone }>({
  topic: "",
  tone: "简洁",
});
const workflowForm = ref({ input: "" });
const functionCallForm = ref({
  query: "帮我对比北京和上海今天的天气，再告诉我两地当前时间，并给穿衣建议。",
});
const ragForm = ref({
  query: "RAG 的评估和优化该怎么做？",
});

const taskOptions: Array<{ key: TaskKey; icon: string; title: string; desc: string }> = [
  { key: "memory", icon: "🧠", title: "记忆对话", desc: "同 sessionId 复用历史上下文" },
  { key: "lcel", icon: "⛓️", title: "LCEL 链", desc: "Prompt → LLM → OutputParser" },
  { key: "workflow", icon: "🧭", title: "LangGraph 工作流", desc: "classify → solve/general → finalize" },
  { key: "functionCall", icon: "🛠️", title: "Function Call", desc: "天气并行工具调用案例" },
  { key: "rag", icon: "📚", title: "RAG Demo", desc: "查询扩展 + 检索 + 重排 + 评估" },
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
};

const resultText = computed(() => (result.value ? JSON.stringify(result.value, null, 2) : ""));
const runButtonText = computed(() => {
  if (loading.value === "memory") return "记忆对话请求中...";
  if (loading.value === "lcel") return "LCEL 链请求中...";
  if (loading.value === "workflow") return "工作流请求中...";
  if (loading.value === "functionCall") return "Function Call 请求中...";
  if (loading.value === "rag") return "RAG Demo 请求中...";
  if (selectedTask.value === "memory") return "运行记忆对话";
  if (selectedTask.value === "lcel") return "运行 LCEL 链";
  if (selectedTask.value === "functionCall") return "运行 Function Call 案例";
  if (selectedTask.value === "rag") return "运行 RAG Demo";
  return "运行 LangGraph 工作流";
});

async function callLearningApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (data as { message?: string; error?: string }).message
      || (data as { error?: string }).error
      || `HTTP ${response.status}`,
    );
  }
  return data as T;
}

function useExample(text: string) {
  if (selectedTask.value === "memory") memoryForm.value.input = text;
  else if (selectedTask.value === "lcel") lcelForm.value.topic = text;
  else if (selectedTask.value === "workflow") workflowForm.value.input = text;
  else if (selectedTask.value === "functionCall") functionCallForm.value.query = text;
  else ragForm.value.query = text;
}

function clearResult() {
  result.value = null;
  errorText.value = "";
}

async function runMemoryChat() {
  if (!memoryForm.value.sessionId.trim() || !memoryForm.value.input.trim()) return;
  loading.value = "memory";
  errorText.value = "";
  try {
    result.value = {
      sessionId: memoryForm.value.sessionId.trim(),
      output: "",
      historyCount: 0,
      mode: "stream",
    };

    const response = await fetch("/api/learning/memory-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: memoryForm.value.sessionId.trim(),
        input: memoryForm.value.input.trim(),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error((errData as { message?: string; error?: string }).message || (errData as { error?: string }).error || `HTTP ${response.status}`);
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

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          streamDone = true;
          break;
        }

        const parsed = JSON.parse(data) as {
          type?: string;
          content?: string;
          sessionId?: string;
          historyCount?: number;
          message?: string;
        };

        if (parsed.type === "token") {
          const current = (result.value as { output?: string } | null)?.output || "";
          result.value = {
            ...(result.value as Record<string, unknown>),
            output: current + (parsed.content || ""),
          };
        }

        if (parsed.type === "meta") {
          result.value = {
            ...(result.value as Record<string, unknown>),
            sessionId: parsed.sessionId || memoryForm.value.sessionId.trim(),
            historyCount: parsed.historyCount ?? 0,
          };
        }

        if (parsed.type === "error") {
          throw new Error(parsed.message || "stream error");
        }
      }
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = null;
  }
}

async function runLcelChain() {
  if (!lcelForm.value.topic.trim()) return;
  loading.value = "lcel";
  errorText.value = "";
  try {
    result.value = await callLearningApi("/api/learning/lcel-chain", {
      topic: lcelForm.value.topic.trim(),
      tone: lcelForm.value.tone,
    });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = null;
  }
}

async function runWorkflow() {
  if (!workflowForm.value.input.trim()) return;
  loading.value = "workflow";
  errorText.value = "";
  try {
    result.value = await callLearningApi("/api/learning/langgraph-workflow", {
      input: workflowForm.value.input.trim(),
    });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = null;
  }
}

async function runFunctionCallCase() {
  if (!functionCallForm.value.query.trim()) return;
  loading.value = "functionCall";
  errorText.value = "";
  try {
    result.value = await callLearningApi("/api/learning/function-call-weather", {
      query: functionCallForm.value.query.trim(),
    });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = null;
  }
}

async function runRagDemo() {
  if (!ragForm.value.query.trim()) return;
  loading.value = "rag";
  errorText.value = "";
  try {
    result.value = await callLearningApi("/api/learning/rag-demo", {
      query: ragForm.value.query.trim(),
    });
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = null;
  }
}

async function runSelectedTask() {
  if (selectedTask.value === "memory") await runMemoryChat();
  else if (selectedTask.value === "lcel") await runLcelChain();
  else if (selectedTask.value === "workflow") await runWorkflow();
  else if (selectedTask.value === "functionCall") await runFunctionCallCase();
  else await runRagDemo();
}
</script>

<template>
  <div class="learning-view">
    <header class="chat-header">
      <div class="header-info">
        <h2 class="header-title">学习页</h2>
        <span class="header-badge">LangChain Playground</span>
      </div>
      <button class="header-btn" @click="clearResult">清空结果</button>
    </header>

    <div class="chat-messages">
      <div class="task-grid">
        <button
          v-for="task in taskOptions"
          :key="task.key"
          class="task-card"
          :class="{ active: selectedTask === task.key }"
          @click="selectedTask = task.key"
        >
          <span class="task-icon">{{ task.icon }}</span>
          <div class="task-content">
            <span class="task-title">{{ task.title }}</span>
            <span class="task-desc">{{ task.desc }}</span>
          </div>
        </button>
      </div>

      <section class="panel">
        <h3 class="panel-title">
          {{ taskOptions.find((t) => t.key === selectedTask)?.icon }}
          {{ taskOptions.find((t) => t.key === selectedTask)?.title }}
        </h3>

        <div v-if="selectedTask === 'memory'" class="form-grid">
          <div class="field">
            <label>Session ID</label>
            <input v-model="memoryForm.sessionId" class="field-input" placeholder="例如 demo-session-1" />
          </div>
          <div class="field">
            <label>输入内容</label>
            <textarea v-model="memoryForm.input" class="field-textarea" rows="4" placeholder="例如：我叫小陈，请记住我的名字。" />
          </div>
        </div>

        <div v-if="selectedTask === 'lcel'" class="form-grid">
          <div class="field">
            <label>Topic</label>
            <input v-model="lcelForm.topic" class="field-input" placeholder="例如 RAG" />
          </div>
          <div class="field">
            <label>Tone</label>
            <select v-model="lcelForm.tone" class="field-input">
              <option value="简洁">简洁</option>
              <option value="专业">专业</option>
              <option value="口语化">口语化</option>
            </select>
          </div>
        </div>

        <div v-if="selectedTask === 'workflow'" class="form-grid">
          <div class="field">
            <label>输入内容</label>
            <textarea v-model="workflowForm.input" class="field-textarea" rows="4" placeholder="例如： (12 + 8) * 3 或 什么是多模态模型？" />
          </div>
        </div>

        <div v-if="selectedTask === 'functionCall'" class="form-grid">
          <div class="field">
            <label>用户问题</label>
            <textarea
              v-model="functionCallForm.query"
              class="field-textarea"
              rows="4"
              placeholder="例如：帮我对比北京和上海今天的天气，再告诉我两地当前时间，并给穿衣建议。"
            />
          </div>
        </div>

        <div v-if="selectedTask === 'rag'" class="form-grid">
          <div class="field">
            <label>RAG 问题</label>
            <textarea
              v-model="ragForm.query"
              class="field-textarea"
              rows="4"
              placeholder="例如：RAG 的评估和优化该怎么做？"
            />
          </div>
        </div>

        <div class="example-list">
          <span class="example-label">示例输入</span>
          <div class="example-chips">
            <button v-for="ex in examples[selectedTask]" :key="ex" class="example-chip" @click="useExample(ex)">
              {{ ex }}
            </button>
          </div>
        </div>
      </section>

      <section class="result-panel">
        <h3>执行结果</h3>
        <p v-if="errorText" class="error">{{ errorText }}</p>
        <template v-else-if="selectedTask === 'rag' && result && typeof result === 'object'">
          <div class="rag-metrics">
            <span class="metric-pill">Faithfulness: {{ (result as any).metrics?.faithfulness ?? "-" }}</span>
            <span class="metric-pill">Relevancy: {{ (result as any).metrics?.relevancy ?? "-" }}</span>
            <span class="metric-pill">Context Recall: {{ (result as any).metrics?.contextRecall ?? "-" }}</span>
          </div>
          <div class="rag-block">
            <strong>查询扩展</strong>
            <ul>
              <li v-for="q in ((result as any).expandedQueries || [])" :key="q">{{ q }}</li>
            </ul>
          </div>
          <div class="rag-block">
            <strong>命中片段</strong>
            <ul>
              <li v-for="c in ((result as any).selectedChunks || [])" :key="c.id">
                [{{ c.docId }}] ({{ c.score }}) {{ c.text }}
              </li>
            </ul>
          </div>
          <div class="rag-block">
            <strong>回答</strong>
            <pre>{{ (result as any).answer }}</pre>
          </div>
        </template>
        <pre v-else-if="resultText">{{ resultText }}</pre>
        <p v-else class="placeholder">运行后结果会显示在这里</p>
      </section>
    </div>

    <div class="chat-input-area">
      <div class="actions">
        <button class="run-btn" :disabled="loading !== null" @click="runSelectedTask">
          {{ runButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.learning-view {
  @include flex-col;
  height: 100vh;
  background: $bg-chat;
}

.chat-header {
  @include flex-between;
  padding: 0 $space-6;
  height: $header-height;
  background: $bg-card;
  border-bottom: 1px solid $border-color;
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

.header-badge {
  font-size: $font-xs;
  color: $text-muted;
  background: $gray-100;
  padding: 2px $space-2;
  border-radius: $radius-xs;
}

.header-btn {
  @include btn-reset;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  padding: $space-2 $space-3;
  font-size: $font-sm;
  color: $text-secondary;

  &:hover {
    border-color: $primary;
    color: $primary;
  }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: $space-6;
  @include flex-col;
  gap: $space-4;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
}

.task-card {
  @include btn-reset;
  display: flex;
  align-items: flex-start;
  gap: $space-3;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-card;
  text-align: left;
  transition: all $transition-fast;

  &:hover {
    border-color: $primary;
    box-shadow: $shadow-sm;
  }

  &.active {
    border-color: $primary;
    background: $primary-bg;
  }
}

.task-icon {
  font-size: 20px;
}

.task-content {
  @include flex-col;
  gap: 2px;
}

.task-title {
  color: $text-primary;
  font-size: $font-sm;
  font-weight: $font-weight-semibold;
}

.task-desc {
  color: $text-muted;
  font-size: $font-xs;
}

.panel,
.result-panel {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: $space-4;
  @include flex-col;
  gap: $space-3;
}

.panel-title {
  color: $text-primary;
  font-size: $font-md;
  font-weight: $font-weight-semibold;
}

.form-grid {
  @include flex-col;
  gap: $space-3;
}

.field {
  @include flex-col;
  gap: $space-1;

  label {
    color: $text-muted;
    font-size: $font-xs;
  }
}

.field-input,
.field-textarea {
  width: 100%;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  padding: $space-2 $space-3;
  background: $bg-chat;
  color: $text-primary;
  font-size: $font-sm;
  outline: none;

  &:focus {
    border-color: $primary;
    box-shadow: 0 0 0 2px $primary-light;
  }
}

.field-textarea {
  resize: vertical;
}

.example-list {
  @include flex-col;
  gap: $space-2;
}

.example-label {
  font-size: $font-xs;
  color: $text-muted;
}

.example-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
}

.example-chip {
  @include btn-reset;
  border: 1px solid $border-color;
  background: $bg-chat;
  color: $text-secondary;
  border-radius: $radius-full;
  padding: $space-1 $space-3;
  font-size: $font-xs;

  &:hover {
    border-color: $primary;
    color: $primary;
  }
}

.result-panel pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: $text-primary;
  background: $bg-chat;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  padding: $space-3;
  font-size: $font-xs;
  font-family: $font-mono;
}

.rag-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
}

.metric-pill {
  font-size: $font-xs;
  color: $text-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-full;
  padding: $space-1 $space-3;
  background: $bg-chat;
}

.rag-block {
  @include flex-col;
  gap: $space-2;

  strong {
    font-size: $font-sm;
    color: $text-primary;
  }

  ul {
    margin: 0;
    padding-left: $space-4;
    @include flex-col;
    gap: $space-1;
    color: $text-secondary;
    font-size: $font-xs;
  }
}

.error {
  color: $error;
  font-size: $font-sm;
}

.placeholder {
  color: $text-muted;
  font-size: $font-sm;
}

.chat-input-area {
  background: $bg-chat;
  padding: $space-3 $space-6 $space-5;
}

.actions {
  max-width: $max-chat-width;
  margin: 0 auto;
}

.run-btn {
  @include btn-base;
  width: 100%;
  justify-content: center;
  background: $primary;
  color: $text-inverse;

  &:hover:not(:disabled) {
    background: $primary-hover;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

@include mobile {
  .chat-header {
    padding: 0 $space-4;
    height: 52px;
  }

  .chat-messages {
    padding: $space-3;
  }

  .task-grid {
    grid-template-columns: 1fr;
  }

  .chat-input-area {
    padding: $space-3;
  }
}
</style>

