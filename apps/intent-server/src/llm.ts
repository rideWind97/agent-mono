/**
 * 原生 OpenAI SDK 调用封装
 *
 * 这就是 LangChain 的 ChatModel 干的事，现在你用 OpenAI SDK 手动实现了
 * 没有 chain、没有 runnable，只有最原始的 HTTP 请求
 */
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";

import { config } from "./config.js";

// ─── 创建 OpenAI 客户端 ──────────────────────────────────
let _client: OpenAI | null = null;

function getClient(apiKey?: string, baseUrl?: string): OpenAI {
  // 如果提供了自定义参数，创建新实例
  if (apiKey || baseUrl) {
    return new OpenAI({
      apiKey: apiKey || config.openaiApiKey,
      baseURL: baseUrl || config.openaiBaseUrl,
    });
  }
  // 否则复用单例
  if (!_client) {
    _client = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl,
    });
  }
  return _client;
}

// ─── 推断默认模型 ─────────────────────────────────────────
function inferModel(baseUrl: string): string {
  const url = baseUrl.toLowerCase();
  if (url.includes("deepseek")) return "deepseek-chat";
  if (url.includes("moonshot")) return "moonshot-v1-8k";
  if (url.includes("bigmodel.cn")) return "glm-4-flash";
  return "gpt-4o-mini";
}

// ─── 参数类型 ─────────────────────────────────────────────
export interface LLMCallOptions {
  /** 自定义 API Key */
  apiKey?: string;
  /** 自定义 Base URL */
  baseUrl?: string;
  /** 模型名称 */
  model?: string;
  /** 温度 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
}

export interface LLMCallResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─── 核心 LLM 调用函数 ───────────────────────────────────
export async function callLLM(
  messages: ChatCompletionMessageParam[],
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  const client = getClient(options.apiKey, options.baseUrl);
  const model =
    options.model || inferModel(options.baseUrl || config.openaiBaseUrl);

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.1, // 意图识别用低温度
    max_tokens: options.maxTokens ?? 1024,
  });

  const choice = response.choices[0];
  const content = choice?.message?.content || "";
  const usage = response.usage
    ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      }
    : undefined;

  return { content, usage };
}

// ─── 便捷函数：单轮对话 ──────────────────────────────────
export async function chat(
  systemPrompt: string,
  userMessage: string,
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  return callLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    options,
  );
}

// ─── 便捷函数：多轮对话 ──────────────────────────────────
export async function chatWithHistory(
  systemPrompt: string,
  history: ChatCompletionMessageParam[],
  userMessage: string,
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  return callLLM(
    [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ],
    options,
  );
}
