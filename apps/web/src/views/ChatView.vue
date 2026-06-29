<script setup lang="ts">
import type { ChatMessage } from "@agent-mono/shared";
import { ref } from "vue";

import { sendChatMessage } from "@/api/chat";

const input = ref("");
const loading = ref(false);
const error = ref("");
const messages = ref<ChatMessage[]>([]);

async function submit() {
  const text = input.value.trim();
  if (!text || loading.value) return;

  error.value = "";
  loading.value = true;
  messages.value.push({ role: "user", content: text });
  input.value = "";

  try {
    const history = messages.value.slice(0, -1);
    const { reply } = await sendChatMessage({ message: text, history });
    messages.value.push({ role: "assistant", content: reply });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "发送失败";
    messages.value.pop();
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="card chat-card">
    <h1>对话</h1>
    <p class="muted">Web → Server → LLM API</p>

    <div class="messages">
      <p v-if="messages.length === 0" class="muted">发送第一条消息开始对话</p>
      <article v-for="(msg, i) in messages" :key="i" :class="['bubble', msg.role]">
        <span class="role">{{ msg.role === "user" ? "你" : "AI" }}</span>
        <p>{{ msg.content }}</p>
      </article>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <form class="composer" @submit.prevent="submit">
      <input v-model="input" type="text" placeholder="输入消息..." :disabled="loading" />
      <button type="submit" :disabled="loading || !input.trim()">
        {{ loading ? "发送中..." : "发送" }}
      </button>
    </form>
  </section>
</template>
