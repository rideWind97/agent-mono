/**
 * 统一配置 + 工具函数
 */

import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
dotenv.config({ path: "../../.env" });

export const config = {
  apiKey: process.env.OPENAI_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  /** 基线模型（微调前的基座模型） */
  baseModel: process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18",
};

export function createClient() {
  if (!config.apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，请在 .env 文件中配置或设置环境变量");
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
}

export function printSection(title: string) {
  const line = "═".repeat(50);
  console.log(`\n\x1b[36m${line}\x1b[0m`);
  console.log(`\x1b[36m  ${title}\x1b[0m`);
  console.log(`\x1b[36m${line}\x1b[0m\n`);
}

export function printStep(phase: string, detail: string) {
  const colors: Record<string, string> = {
    observe: "\x1b[33m",
    think: "\x1b[35m",
    act: "\x1b[32m",
    result: "\x1b[36m",
    error: "\x1b[31m",
    warn: "\x1b[33m",
    data: "\x1b[34m",
    cost: "\x1b[35m",
  };
  const color = colors[phase] || "\x1b[0m";
  console.log(`${color}[${phase.toUpperCase()}]\x1b[0m ${detail}`);
}
