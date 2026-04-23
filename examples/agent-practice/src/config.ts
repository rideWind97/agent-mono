/**
 * 统一配置：从环境变量加载 API Key 和 Base URL
 *
 * 支持两种方式：
 * 1. 在本目录创建 .env 文件
 * 2. 继承根目录的环境变量
 */

import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";

// 优先加载本目录的 .env，再加载根目录的 .env
dotenv.config();
dotenv.config({ path: "../../.env" });

export const config = {
  apiKey: process.env.OPENAI_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
};

/**
 * 创建 LLM 实例的工厂函数
 *
 * 为什么封装？
 * - 统一管理 API Key、Base URL、模型参数
 * - 方便在所有 Demo 中复用，避免重复配置
 * - temperature 默认 0 以保证输出的可复现性（教学场景很重要）
 */
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

/**
 * 日志辅助函数 —— 彩色分段打印，方便观察 Agent 执行过程
 */
export function printSection(title: string) {
  const line = "═".repeat(50);
  console.log(`\n\x1b[36m${line}\x1b[0m`);
  console.log(`\x1b[36m  ${title}\x1b[0m`);
  console.log(`\x1b[36m${line}\x1b[0m\n`);
}

export function printStep(phase: string, detail: string) {
  const colors: Record<string, string> = {
    observe: "\x1b[33m",   // 黄色 —— 感知
    think: "\x1b[35m",     // 紫色 —— 推理
    act: "\x1b[32m",       // 绿色 —— 行动
    tool: "\x1b[34m",      // 蓝色 —— 工具调用
    result: "\x1b[36m",    // 青色 —— 结果
    error: "\x1b[31m",     // 红色 —— 错误
  };
  const color = colors[phase] || "\x1b[0m";
  console.log(`${color}[${phase.toUpperCase()}]\x1b[0m ${detail}`);
}
