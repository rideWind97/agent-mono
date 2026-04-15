import { ref } from "vue";

import { requestAgentChat } from "./agent/api";
import { loadAgentConfig, saveAgentConfig } from "./agent/configStorage";
import { streamAgentEvents } from "./agent/sse";
import {
  DEFAULT_AGENT_CONFIG,
  type AgentConfig,
  type AgentServerEvent,
  type ChatMessage,
  type ToolCallEvent,
  type UploadedImagePreview,
} from "./agent/types";
import { dispatchToolEffect } from "./clientToolEffects";

export type { AgentConfig, ChatMessage, ToolCallEvent, UploadedImagePreview };

export function useAgent() {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const agentConfig = ref<AgentConfig>(loadAgentConfig(DEFAULT_AGENT_CONFIG));
  const currentToolCalls = ref<ToolCallEvent[]>([]);
  const imagePreviews = ref<UploadedImagePreview[]>([]);

  function saveConfig() {
    saveAgentConfig(agentConfig.value);
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addImagePreview(params: { name: string; url: string }) {
    imagePreviews.value = [
      ...imagePreviews.value,
      {
        id: generateId(),
        name: params.name,
        url: params.url,
        timestamp: Date.now(),
      },
    ];
  }

  function appendAssistantById(assistantId: string, appendText: string) {
    const idx = messages.value.findIndex((m) => m.id === assistantId);
    if (idx < 0) return;
    const msg = messages.value[idx];
    const updated: ChatMessage = { ...msg, content: msg.content + appendText };
    messages.value = [
      ...messages.value.slice(0, idx),
      updated,
      ...messages.value.slice(idx + 1),
    ];
  }

  function replaceAssistantById(assistantId: string, updater: (msg: ChatMessage) => ChatMessage) {
    const idx = messages.value.findIndex((m) => m.id === assistantId);
    if (idx < 0) return;
    const updated = updater({ ...messages.value[idx] });
    messages.value = [
      ...messages.value.slice(0, idx),
      updated,
      ...messages.value.slice(idx + 1),
    ];
  }

  function handleAgentEvent(event: AgentServerEvent, assistantId: string) {
    if (event.type === "token") {
      appendAssistantById(assistantId, event.content || "");
      return;
    }

    if (event.type === "tool_start") {
      const toolEvent: ToolCallEvent = {
        type: "tool_start",
        tool: event.tool || "",
        input: event.input,
      };
      currentToolCalls.value.push(toolEvent);
      replaceAssistantById(assistantId, (msg) => ({
        ...msg,
        toolCalls: [...currentToolCalls.value],
      }));
      return;
    }

    if (event.type === "tool_end") {
      const toolEvent: ToolCallEvent = {
        type: "tool_end",
        tool: event.tool || "",
        output: event.output,
      };
      dispatchToolEffect(toolEvent.tool, toolEvent.output, {
        addImagePreview,
        appendAssistantText: (text) => appendAssistantById(assistantId, text),
      });
      currentToolCalls.value.push(toolEvent);
      replaceAssistantById(assistantId, (msg) => ({
        ...msg,
        toolCalls: [...currentToolCalls.value],
      }));
      return;
    }

    if (event.type === "error") {
      appendAssistantById(assistantId, `\n\n⚠️ ${event.message}`);
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading.value) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };
    messages.value.push(userMsg);

    // Prepare assistant message placeholder
    const assistantId = generateId();
    messages.value = [
      ...messages.value,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        timestamp: Date.now(),
      },
    ];

    isLoading.value = true;
    currentToolCalls.value = [];

    try {
      const chatHistory = messages.value.slice(0, -1);
      const response = await requestAgentChat(chatHistory, agentConfig.value);
      for await (const event of streamAgentEvents(response)) {
        handleAgentEvent(event, assistantId);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      replaceAssistantById(assistantId, (msg) => ({
        ...msg,
        content: `❌ 请求失败: ${errMsg}`,
      }));
    } finally {
      isLoading.value = false;
    }
  }

  function clearMessages() {
    for (const preview of imagePreviews.value) {
      URL.revokeObjectURL(preview.url);
    }
    messages.value = [];
    currentToolCalls.value = [];
    imagePreviews.value = [];
  }

  return {
    messages,
    isLoading,
    agentConfig,
    currentToolCalls,
    imagePreviews,
    sendMessage,
    clearMessages,
    saveConfig,
  };
}
