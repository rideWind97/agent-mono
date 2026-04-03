/**
 * 配置管理 — 从环境变量读取，不依赖任何框架
 */
import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3200,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
  defaultModel: process.env.DEFAULT_MODEL || "deepseek-chat",
};
