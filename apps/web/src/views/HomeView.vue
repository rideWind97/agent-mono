<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import { fetchHealth } from "@/api/chat";

const health = ref("检查中...");
const error = ref("");

onMounted(async () => {
  try {
    const data = await fetchHealth();
    health.value = data.ok ? "Server 已连接" : "Server 异常";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "连接失败";
    health.value = "Server 未启动";
  }
});
</script>

<template>
  <section class="card">
    <h1>Agent 学习 Monorepo</h1>
    <p class="muted">Web（Vue）+ Server（Fastify）同仓开发，后续 Agent 能力在 apps 里迭代。</p>

    <div class="status-row">
      <span class="label">后端状态</span>
      <span :class="['badge', error ? 'badge-warn' : 'badge-ok']">{{ health }}</span>
    </div>
    <p v-if="error" class="error">{{ error }} — 请先运行 <code>pnpm dev:server</code></p>

    <ul class="links">
      <li><RouterLink to="/chat">对话页 →</RouterLink></li>
      <li><RouterLink to="/learning">Week 3 LCEL / Memory →</RouterLink></li>
      <li>CLI 练习：<code>pnpm week1</code> · <code>pnpm week2</code></li>
    </ul>
  </section>
</template>
