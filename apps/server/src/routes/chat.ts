import type { ChatRequest, ChatResponse } from "@agent-mono/shared";
import type { FastifyPluginAsync } from "fastify";

import { serverConfig } from "../config.js";

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ChatRequest; Reply: ChatResponse | { error: string } }>(
    "/api/chat",
    async (request, reply) => {
      const { message, history = [] } = request.body;

      if (!message?.trim()) {
        return reply.status(400).send({ error: "message 不能为空" });
      }

      if (!serverConfig.openaiApiKey || serverConfig.openaiApiKey === "sk-your-key-here") {
        return reply.status(503).send({ error: "请先在根目录 .env 配置 OPENAI_API_KEY" });
      }

      const messages = [
        { role: "system" as const, content: "你是一个简洁友好的 AI 助手。" },
        ...history,
        { role: "user" as const, content: message.trim() },
      ];

      const res = await fetch(`${serverConfig.openaiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serverConfig.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: serverConfig.openaiModel,
          messages,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        request.log.error({ status: res.status, errText }, "LLM API error");
        return reply.status(502).send({ error: `LLM API 错误: ${res.status}` });
      }

      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const replyText = data.choices[0]?.message.content ?? "";
      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined;

      return { reply: replyText, usage };
    },
  );
};
