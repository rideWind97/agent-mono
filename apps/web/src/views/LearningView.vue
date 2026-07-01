<script setup lang="ts">
import type { CityWeatherResult } from "@agent-mono/shared";
import { onMounted, ref } from "vue";

import { fetchCityWeather, resetMemoryChat, sendMemoryChat } from "@/api/learning";
import LangGraphWorkflowDemo from "@/components/learning/LangGraphWorkflowDemo.vue";
import WeatherAgentDemo from "@/components/learning/WeatherAgentDemo.vue";

const city = ref("上海");
const cityLoading = ref(false);
const cityError = ref("");
const cityResult = ref<CityWeatherResult | null>(null);
const pipeline = ref<string[]>([]);

const sessionId = ref("");
const memoryInput = ref("");
const memoryLoading = ref(false);
const memoryError = ref("");
const memoryMessages = ref<{ role: "user" | "assistant"; content: string }[]>([]);
const messageCount = ref(0);

function newSessionId() {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

onMounted(() => {
  sessionId.value = newSessionId();
});

async function runLcelCity() {
  const name = city.value.trim();
  if (!name || cityLoading.value) return;

  cityError.value = "";
  cityLoading.value = true;
  cityResult.value = null;
  pipeline.value = [];

  try {
    const data = await fetchCityWeather({ city: name });
    cityResult.value = data.result;
    pipeline.value = data.pipeline;
  } catch (e) {
    cityError.value = e instanceof Error ? e.message : "请求失败";
  } finally {
    cityLoading.value = false;
  }
}

async function sendMemory() {
  const text = memoryInput.value.trim();
  if (!text || memoryLoading.value) return;

  memoryError.value = "";
  memoryLoading.value = true;
  memoryMessages.value.push({ role: "user", content: text });
  memoryInput.value = "";

  try {
    const data = await sendMemoryChat({ sessionId: sessionId.value, message: text });
    memoryMessages.value.push({ role: "assistant", content: data.reply });
    messageCount.value = data.messageCount;
  } catch (e) {
    memoryError.value = e instanceof Error ? e.message : "发送失败";
    memoryMessages.value.pop();
  } finally {
    memoryLoading.value = false;
  }
}

async function resetMemory() {
  await resetMemoryChat(sessionId.value);
  sessionId.value = newSessionId();
  memoryMessages.value = [];
  messageCount.value = 0;
  memoryError.value = "";
}
</script>

<template>
  <div class="learning">
    <section class="card">
      <h1>Week 3 · LCEL 城市天气链</h1>
      <p class="muted">
        Prompt → ChatModel → OutputParser
      </p>

      <div class="pipeline">
        <span
          v-for="(step, i) in ['PromptTemplate', 'ChatModel', 'OutputParser']"
          :key="step"
          class="pipeline-step"
          :class="{ active: pipeline.includes(step) }"
        >
          {{ step }}
          <span v-if="i < 2">→</span>
        </span>
      </div>

      <form
        class="row"
        @submit.prevent="runLcelCity"
      >
        <input
          v-model="city"
          type="text"
          placeholder="输入城市名"
          :disabled="cityLoading"
        >
        <button
          type="submit"
          :disabled="cityLoading || !city.trim()"
        >
          {{ cityLoading ? "运行中..." : "运行 LCEL" }}
        </button>
      </form>

      <p
        v-if="cityError"
        class="error"
      >
        {{ cityError }}
      </p>

      <pre
        v-if="cityResult"
        class="json-out"
      >{{ JSON.stringify(cityResult, null, 2) }}</pre>
    </section>

    <section class="card">
      <h1>Memory 多轮对话</h1>
      <p class="muted">
        RunnableWithMessageHistory · session: {{ sessionId }}
      </p>
      <p class="muted">
        试试：先说「我叫小明，喜欢简短回答」，再问「我叫什么？喜欢什么？」
      </p>

      <div class="messages">
        <p
          v-if="memoryMessages.length === 0"
          class="muted"
        >
          发送消息开始（Memory 在服务端按 sessionId 保持）
        </p>
        <article
          v-for="(msg, i) in memoryMessages"
          :key="i"
          :class="['bubble', msg.role]"
        >
          <span class="role">{{ msg.role === "user" ? "你" : "AI" }}</span>
          <p>{{ msg.content }}</p>
        </article>
      </div>

      <p
        v-if="messageCount"
        class="muted"
      >
        服务端历史消息数：{{ messageCount }}
      </p>
      <p
        v-if="memoryError"
        class="error"
      >
        {{ memoryError }}
      </p>

      <form
        class="row"
        @submit.prevent="sendMemory"
      >
        <input
          v-model="memoryInput"
          type="text"
          placeholder="输入消息..."
          :disabled="memoryLoading"
        >
        <button
          type="submit"
          :disabled="memoryLoading || !memoryInput.trim()"
        >
          发送
        </button>
        <button
          type="button"
          class="secondary"
          @click="resetMemory"
        >
          清空 Memory
        </button>
      </form>
    </section>

    <LangGraphWorkflowDemo />
    <WeatherAgentDemo />
  </div>
</template>

<style scoped>
.learning {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 720px;
}

.pipeline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 1rem 0;
  font-size: 0.85rem;
}

.pipeline-step {
  color: var(--muted);
}

.pipeline-step.active {
  color: var(--accent);
  font-weight: 600;
}

.row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.row input {
  flex: 1;
  min-width: 160px;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}

.row button {
  padding: 0.65rem 1rem;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.row button.secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.json-out {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  overflow-x: auto;
  font-size: 0.9rem;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 1rem 0;
  max-height: 280px;
  overflow-y: auto;
}

.bubble {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.bubble.user {
  align-self: flex-end;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.bubble .role {
  display: block;
  font-size: 0.75rem;
  color: var(--muted);
  margin-bottom: 0.25rem;
}
</style>
