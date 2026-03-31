export type AgentProvider = "openai" | "gemini";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/** 工具调用记录 */
export interface ToolCall {
  tool: string;
  input?: unknown;
  output?: unknown;
  status: "running" | "done";
}

export const AGENT_SYSTEM_PROMPT =
  "你是一个拥有工具能力的 AI 代理。你可以查询天气、进行数学计算、获取当前时间。请根据用户的问题合理使用工具来回答。";

export const GEMINI_AGENT_MODELS = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  {
    value: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash Lite (Preview)",
  },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)" },
] as const;

export const AGENT_SUGGESTIONS = [
  "今天北京天气怎么样？",
  "帮我算一下 (123 + 456) * 789",
  "现在几点了？",
] as const;
