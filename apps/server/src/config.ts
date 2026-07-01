import { resolve } from "node:path";

import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "../../../.env") });

export const serverConfig = {
  port: Number(process.env.SERVER_PORT ?? 3001),
  host: process.env.SERVER_HOST ?? "0.0.0.0",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
};

export function assertServerConfig() {
  if (!serverConfig.openaiApiKey || serverConfig.openaiApiKey === "sk-your-key-here") {
    console.warn("[server] 未配置 OPENAI_API_KEY，/api/chat 将返回 503");
  }
}
