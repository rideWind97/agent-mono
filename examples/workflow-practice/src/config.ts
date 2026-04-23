/**
 * 统一配置：从环境变量加载 API Key 和 Base URL
 * 与 agent-practice 保持一致的配置模式
 */

import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";

dotenv.config();
dotenv.config({ path: "../../.env" });

export const config = {
  apiKey: process.env.OPENAI_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
};

export function createLLM(overrides?: {
  model?: string;
  temperature?: number;
}) {
  if (!config.apiKey) {
    throw new Error(
      "缺少 OPENAI_API_KEY，请在 .env 文件中配置或设置环境变量"
    );
  }
  return new ChatOpenAI({
    model: overrides?.model ?? config.model,
    apiKey: config.apiKey,
    configuration: { baseURL: config.baseUrl },
    temperature: overrides?.temperature ?? 0,
  });
}

/** 彩色分段标题 */
export function printSection(title: string) {
  const line = "═".repeat(50);
  console.log(`\n\x1b[36m${line}\x1b[0m`);
  console.log(`\x1b[36m  ${title}\x1b[0m`);
  console.log(`\x1b[36m${line}\x1b[0m\n`);
}

/** 按阶段着色的步骤打印 */
export function printStep(phase: string, detail: string) {
  const colors: Record<string, string> = {
    observe: "\x1b[33m",   // 黄色
    think: "\x1b[35m",     // 紫色
    act: "\x1b[32m",       // 绿色
    tool: "\x1b[34m",      // 蓝色
    result: "\x1b[36m",    // 青色
    error: "\x1b[31m",     // 红色
    approve: "\x1b[32m",   // 绿色
    reject: "\x1b[31m",    // 红色
    retry: "\x1b[33m",     // 黄色
    persist: "\x1b[34m",   // 蓝色
  };
  const color = colors[phase] || "\x1b[0m";
  console.log(`${color}[${phase.toUpperCase()}]\x1b[0m ${detail}`);
}
