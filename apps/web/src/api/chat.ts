import type { ChatRequest, ChatResponse } from "@agent-mono/shared";

export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as ChatResponse | { error: string };

  if (!res.ok) {
    throw new Error("error" in data ? data.error : `请求失败: ${res.status}`);
  }

  return data as ChatResponse;
}

export async function fetchHealth() {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`health check failed: ${res.status}`);
  return res.json() as Promise<{ ok: boolean; service: string; timestamp: number }>;
}
