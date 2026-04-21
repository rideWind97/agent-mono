export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  messages: Message[];
  intent: string;
  status: "ai" | "human" | "closed";
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Intent {
  name: string;
  confidence: number;
  slots?: Record<string, string>;
}

export interface IntentDefinition {
  name: string;
  description: string;
  examples: string[];
  requireHuman: boolean;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  intent?: Intent;
  status: string;
}

export interface WSMessage {
  type: string;
  sessionId: string;
  content?: string;
  from?: string;
}

export type SSEEventType =
  | "session"
  | "intent"
  | "delta"
  | "message"
  | "error"
  | "done";

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
}
