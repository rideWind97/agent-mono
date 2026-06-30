import { llmEnv } from "./env.js";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface ChatResult {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number } = {},
): Promise<ChatResult> {
  const res = await fetch(`${llmEnv.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmEnv.apiKey}`,
    },
    body: JSON.stringify({
      model: llmEnv.model,
      messages,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  return {
    content: data.choices[0]?.message.content ?? "",
    usage: data.usage,
  };
}

export function formatUsage(usage: ChatResult["usage"]) {
  if (!usage) return "（响应未包含 usage）";
  return `input: ${usage.prompt_tokens}, output: ${usage.completion_tokens}, total: ${usage.total_tokens}`;
}
