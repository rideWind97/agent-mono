<script setup lang="ts">
import type { WeatherCompareResponse, WeatherFlowEvent } from "@agent-mono/shared";
import { computed, ref } from "vue";

import { runWeatherAgent } from "@/api/learning";

const question = ref("帮我对比北京和上海今天的天气，并告诉我两地当前时间与温差建议");
const loading = ref(false);
const error = ref("");
const result = ref<WeatherCompareResponse | null>(null);

const flowGroups = computed(() => {
  const events = result.value?.flow ?? [];
  return events.map((event, index) => ({
    key: `${event.type}-${index}`,
    event,
  }));
});

function eventTitle(event: WeatherFlowEvent) {
  if (event.type === "tool_start") return `开始：${event.name}`;
  if (event.type === "tool_end") return `完成：${event.name}`;
  if (event.type === "error") return `重试/错误：${event.name}`;
  return "最终回答";
}

async function submit() {
  const text = question.value.trim();
  if (!text || loading.value) return;

  loading.value = true;
  error.value = "";
  result.value = null;

  try {
    result.value = await runWeatherAgent({ question: text });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "天气 Agent 执行失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h1>Week 5 · Function Calling 天气 Agent</h1>
    <p class="muted">
      模型决定工具调用，Server 并行执行天气 / 时间工具，失败时按 200ms / 500ms / 1000ms 重试。
    </p>

    <form
      class="row"
      @submit.prevent="submit"
    >
      <input
        v-model="question"
        type="text"
        placeholder="例如：对比北京和上海天气"
        :disabled="loading"
      >
      <button
        type="submit"
        :disabled="loading || !question.trim()"
      >
        {{ loading ? "运行中..." : "运行天气 Agent" }}
      </button>
    </form>

    <p class="muted">
      模拟超时：在问题中加入「超时」，第一个城市的天气工具会失败 3 次后成功。
    </p>

    <p
      v-if="error"
      class="error"
    >
      {{ error }}
    </p>

    <div
      v-if="result"
      class="agent-result"
    >
      <h2>最终回答</h2>
      <p class="answer">
        {{ result.answer }}
      </p>

      <h2>结构化结果</h2>
      <div class="city-grid">
        <article
          v-for="city in result.cities"
          :key="city.city"
          class="city-card"
        >
          <strong>{{ city.city }}</strong>
          <span>{{ city.weather?.condition ?? "天气未知" }}</span>
          <span>{{ city.weather ? `${city.weather.temperature}°C` : "-" }}</span>
          <span>{{ city.currentTime ?? "时间未知" }}</span>
        </article>
      </div>
      <p class="muted">
        温差：{{ result.tempDiff ?? "未知" }}°C · {{ result.advice }}
      </p>

      <h2>工具调用轨迹</h2>
      <ol class="flow-list">
        <li
          v-for="{ key, event } in flowGroups"
          :key="key"
          :class="['flow-item', event.type]"
        >
          <strong>{{ eventTitle(event) }}</strong>
          <span v-if="event.type !== 'token'">
            {{ event.detail }}（第 {{ event.attempt }} 次）
          </span>
          <span v-else>{{ event.content }}</span>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.agent-result {
  margin-top: 1rem;
}

.answer {
  white-space: pre-wrap;
}

.city-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  margin: 0.75rem 0;
}

.city-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.flow-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 1.25rem;
}

.flow-item {
  padding: 0.25rem 0;
}

.flow-item strong {
  display: inline-block;
  min-width: 128px;
  color: var(--accent);
}

.flow-item.error strong {
  color: var(--error);
}

.flow-item.tool_end strong {
  color: var(--ok);
}
</style>
