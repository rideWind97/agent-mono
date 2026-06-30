import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../../.env") });

export const llmEnv = {
  apiKey: process.env.OPENAI_API_KEY ?? "",
  baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
};

export function assertLlmEnv() {
  if (!llmEnv.apiKey || llmEnv.apiKey === "sk-your-key-here") {
    console.error("请先在仓库根目录 .env 中配置 OPENAI_API_KEY");
    process.exit(1);
  }
}
