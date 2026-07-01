<script setup lang="ts">
import type { LangGraphRouterResponse, LangGraphWorkflowResponse } from "@agent-mono/shared";
import { ref } from "vue";

import { runLangGraphRouter, runLangGraphWorkflow } from "@/api/learning";

const workflowInput = ref("(12 + 8) * 3");
const workflowLoading = ref(false);
const workflowError = ref("");
const workflowResult = ref<LangGraphWorkflowResponse | null>(null);

const routerInput = ref("12 / 4 + 7");
const routerLoading = ref(false);
const routerError = ref("");
const routerResult = ref<LangGraphRouterResponse | null>(null);

async function submitWorkflow() {
  const input = workflowInput.value.trim();
  if (!input || workflowLoading.value) return;

  workflowLoading.value = true;
  workflowError.value = "";
  workflowResult.value = null;

  try {
    workflowResult.value = await runLangGraphWorkflow({ input });
  } catch (e) {
    workflowError.value = e instanceof Error ? e.message : "执行失败";
  } finally {
    workflowLoading.value = false;
  }
}

async function submitRouter() {
  const input = routerInput.value.trim();
  if (!input || routerLoading.value) return;

  routerLoading.value = true;
  routerError.value = "";
  routerResult.value = null;

  try {
    routerResult.value = await runLangGraphRouter({ input });
  } catch (e) {
    routerError.value = e instanceof Error ? e.message : "执行失败";
  } finally {
    routerLoading.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h1>Week 4 · LangGraph 工作流</h1>
    <p class="muted">
      StateGraph 把每个节点的输出合并到共享 State，下面的 steps 就是图执行路径。
    </p>

    <div class="graph-demo">
      <h2>4 节点工作流</h2>
      <p class="muted">
        固定路径：classify → plan → solveMath → finalize
      </p>

      <form
        class="row"
        @submit.prevent="submitWorkflow"
      >
        <input
          v-model="workflowInput"
          type="text"
          placeholder="输入数学表达式，如 (12 + 8) * 3"
          :disabled="workflowLoading"
        >
        <button
          type="submit"
          :disabled="workflowLoading || !workflowInput.trim()"
        >
          {{ workflowLoading ? "运行中..." : "运行工作流" }}
        </button>
      </form>

      <p
        v-if="workflowError"
        class="error"
      >
        {{ workflowError }}
      </p>

      <div
        v-if="workflowResult"
        class="result-block"
      >
        <p><strong>分类：</strong>{{ workflowResult.classification }}</p>
        <p><strong>计划：</strong>{{ workflowResult.plan }}</p>
        <p><strong>结果：</strong>{{ workflowResult.result }}</p>

        <ol class="steps">
          <li
            v-for="step in workflowResult.steps"
            :key="`${step.node}-${step.detail}`"
          >
            <strong>{{ step.node }}</strong>
            <span>{{ step.detail }}</span>
          </li>
        </ol>
      </div>
    </div>

    <div class="graph-demo">
      <h2>3 节点分类图</h2>
      <p class="muted">
        自定义图：classify → answer → finalize。数学走计算，否则走普通回复。
      </p>

      <form
        class="row"
        @submit.prevent="submitRouter"
      >
        <input
          v-model="routerInput"
          type="text"
          placeholder="输入数学表达式或普通文本"
          :disabled="routerLoading"
        >
        <button
          type="submit"
          :disabled="routerLoading || !routerInput.trim()"
        >
          {{ routerLoading ? "运行中..." : "运行 3 节点图" }}
        </button>
      </form>

      <p
        v-if="routerError"
        class="error"
      >
        {{ routerError }}
      </p>

      <div
        v-if="routerResult"
        class="result-block"
      >
        <p><strong>分类：</strong>{{ routerResult.classification }}</p>
        <p><strong>回答：</strong>{{ routerResult.answer }}</p>

        <ol class="steps">
          <li
            v-for="step in routerResult.steps"
            :key="`${step.node}-${step.detail}`"
          >
            <strong>{{ step.node }}</strong>
            <span>{{ step.detail }}</span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.graph-demo {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.graph-demo h2 {
  margin-bottom: 0.25rem;
  font-size: 1.1rem;
}

.result-block {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 1.25rem;
}

.steps li strong {
  display: inline-block;
  min-width: 88px;
  color: var(--accent);
}
</style>
