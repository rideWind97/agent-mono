export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallEvent[];
  timestamp: number;
}

export interface ToolCallEvent {
  type: "tool_start" | "tool_end";
  tool: string;
  input?: unknown;
  output?: string;
}

export interface UploadedImagePreview {
  id: string;
  name: string;
  url: string;
  timestamp: number;
}

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const AGENT_CONFIG_STORAGE_KEY = "agent-config";

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com",
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 2048,
};

export interface AgentServerEvent {
  type: "token" | "tool_start" | "tool_end" | "error";
  content?: string;
  tool?: string;
  input?: unknown;
  output?: string;
  message?: string;
}
