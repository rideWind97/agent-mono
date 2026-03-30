export type Provider = "openai" | "gemini";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export const SYSTEM_PROMPT =
  "你是一个友好的 AI 助手，擅长用简洁清晰的中文回答问题。请尽量给出有帮助的回答。";

export const GEMINI_MODELS = [
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
  {
    value: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash Lite (Preview)",
  },
  {
    value: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image (Preview)",
  },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)" },
  {
    value: "gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image (Preview)",
  },
] as const;

export const CHAT_SUGGESTIONS = [
  "解释一下什么是 Transformer 架构",
  "用 TypeScript 写一个快速排序",
  "前端开发者如何学习 AI 应用开发？",
] as const;
