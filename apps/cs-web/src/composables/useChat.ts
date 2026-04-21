import { ref, computed } from "vue";
import { api } from "@/api";
import type { Message, Intent, SSEEventType } from "@/types";

export function useChat() {
  const sessionId = ref("");
  const messages = ref<Message[]>([]);
  const status = ref<"ai" | "human" | "closed">("ai");
  const currentIntent = ref<Intent | null>(null);
  const isLoading = ref(false);
  const streamingContent = ref("");
  const error = ref("");

  const isHuman = computed(() => status.value === "human");

  async function initSession() {
    try {
      const { session } = await api.createSession();
      sessionId.value = session.id;
      messages.value = [];
      status.value = "ai";
      currentIntent.value = null;
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading.value) return;

    if (!sessionId.value) {
      await initSession();
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    messages.value.push(userMsg);

    isLoading.value = true;
    streamingContent.value = "";
    error.value = "";

    try {
      const response = await api.chatStream({
        sessionId: sessionId.value,
        message: content,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event: ")) {
            const eventType = trimmed.slice(7) as SSEEventType;
            const nextDataLine = lines[lines.indexOf(line) + 1];
            if (!nextDataLine?.startsWith("data: ")) continue;

            const data = JSON.parse(nextDataLine.slice(6));

            switch (eventType) {
              case "session":
                if (data.sessionId) sessionId.value = data.sessionId;
                if (data.status) status.value = data.status;
                break;
              case "intent":
                currentIntent.value = data.intent;
                break;
              case "delta":
                fullContent += data.content;
                streamingContent.value = fullContent;
                break;
              case "message":
                fullContent = data.content || fullContent;
                if (data.status) status.value = data.status;
                break;
              case "error":
                error.value = data.message || "Unknown error";
                break;
              case "done":
                break;
            }
          }
        }
      }

      if (fullContent) {
        messages.value.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullContent,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      error.value = (e as Error).message;
      messages.value.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "抱歉，发生了网络错误，请稍后重试。",
        timestamp: new Date().toISOString(),
      });
    } finally {
      isLoading.value = false;
      streamingContent.value = "";
    }
  }

  async function transferToHuman() {
    if (!sessionId.value) return;
    try {
      await api.transferToHuman(sessionId.value);
      status.value = "human";
      messages.value.push({
        id: crypto.randomUUID(),
        role: "system",
        content: "正在为您转接人工客服，请稍候...",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  function reset() {
    sessionId.value = "";
    messages.value = [];
    status.value = "ai";
    currentIntent.value = null;
    isLoading.value = false;
    streamingContent.value = "";
    error.value = "";
  }

  return {
    sessionId,
    messages,
    status,
    currentIntent,
    isLoading,
    streamingContent,
    error,
    isHuman,
    initSession,
    sendMessage,
    transferToHuman,
    reset,
  };
}
