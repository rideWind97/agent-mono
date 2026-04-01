import type { AgentConfig, ChatMessage } from "./types";

interface AgentChatBody {
  messages: Array<{ role: ChatMessage["role"]; content: string }>;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

function buildAgentChatBody(messages: ChatMessage[], config: AgentConfig): AgentChatBody {
  return {
    messages: messages
      .filter((m) => m.role !== "assistant" || m.content)
      .map((m) => ({ role: m.role, content: m.content })),
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  };
}

export async function requestAgentChat(messages: ChatMessage[], config: AgentConfig): Promise<Response> {
  const body = buildAgentChatBody(messages, config);
  const response = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  return response;
}
