import { ChatOpenAI } from "@langchain/openai";

import { serverConfig } from "../config.js";

export function createChatModel(options: { temperature?: number } = {}) {
  return new ChatOpenAI({
    model: serverConfig.openaiModel,
    apiKey: serverConfig.openaiApiKey,
    temperature: options.temperature ?? 0.3,
    configuration: {
      baseURL: serverConfig.openaiBaseUrl,
    },
  });
}

export function isLlmConfigured() {
  return Boolean(serverConfig.openaiApiKey && serverConfig.openaiApiKey !== "sk-your-key-here");
}
