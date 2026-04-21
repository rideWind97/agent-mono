import type {
  ChatRequest,
  ChatResponse,
  IntentDefinition,
  KnowledgeDoc,
  Session,
} from "@/types";

const BASE = "/api/cs";

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Sessions
  createSession: () =>
    request<{ session: Session }>("/sessions", { method: "POST" }),

  getSession: (id: string) =>
    request<{ session: Session }>(`/sessions/${id}`),

  listSessions: (status?: string) =>
    request<{ sessions: Session[] }>(
      `/sessions${status ? `?status=${status}` : ""}`,
    ),

  // Chat (non-streaming)
  chat: (data: ChatRequest) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Chat (SSE streaming) — returns raw Response for manual parsing
  chatStream: (data: ChatRequest): Promise<Response> =>
    fetch(`${BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  // Transfer
  transferToHuman: (sessionId: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/transfer/human`, {
      method: "POST",
    }),

  transferToAI: (sessionId: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/transfer/ai`, {
      method: "POST",
    }),

  // Knowledge base
  listKnowledge: () =>
    request<{ docs: KnowledgeDoc[] }>("/knowledge"),

  createKnowledge: (doc: Omit<KnowledgeDoc, "id">) =>
    request<{ message: string }>("/knowledge", {
      method: "POST",
      body: JSON.stringify(doc),
    }),

  deleteKnowledge: (id: string) =>
    request<{ message: string }>(`/knowledge/${id}`, { method: "DELETE" }),

  searchKnowledge: (q: string) =>
    request<{ results: Array<{ content: string; score: number }> }>(
      `/knowledge/search?q=${encodeURIComponent(q)}`,
    ),

  // Intents
  listIntents: () =>
    request<{ intents: IntentDefinition[] }>("/intents"),

  recognizeIntent: (message: string) =>
    request<{ intent: { name: string; confidence: number } }>(
      "/intents/recognize",
      { method: "POST", body: JSON.stringify({ message }) },
    ),
};
