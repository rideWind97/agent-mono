import type {
  CityWeatherRequest,
  CityWeatherResponse,
  LangGraphRouterRequest,
  LangGraphRouterResponse,
  LangGraphWorkflowRequest,
  LangGraphWorkflowResponse,
  MemoryChatRequest,
  MemoryChatResponse,
  MemoryResetRequest,
  MemoryResetResponse,
  WeatherCompareRequest,
  WeatherCompareResponse,
} from "@agent-mono/shared";
import type { FastifyPluginAsync } from "fastify";

import { runMathWorkflow, runThreeNodeRouter } from "../lib/langgraph/simple-workflow.js";
import { runCityWeatherChain } from "../lib/lcel/city-weather-chain.js";
import { isLlmConfigured } from "../lib/llm.js";
import { resetMemorySession, runMemoryChat } from "../lib/memory/memory-chat.js";
import { runWeatherCompareAgent } from "../lib/tools/weather-agent.js";

export const learningRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CityWeatherRequest; Reply: CityWeatherResponse | { error: string } }>(
    "/api/learning/lcel-city",
    async (request, reply) => {
      const city = request.body.city?.trim();
      if (!city) {
        return reply.status(400).send({ error: "city 不能为空" });
      }
      if (!isLlmConfigured()) {
        return reply.status(503).send({ error: "请先在根目录 .env 配置 OPENAI_API_KEY" });
      }

      try {
        const result = await runCityWeatherChain(city);
        return {
          result,
          pipeline: ["PromptTemplate", "ChatModel", "OutputParser"],
        };
      } catch (err) {
        request.log.error(err, "lcel-city failed");
        return reply.status(502).send({ error: "LCEL 链执行失败" });
      }
    },
  );

  app.post<{ Body: MemoryChatRequest; Reply: MemoryChatResponse | { error: string } }>(
    "/api/learning/memory-chat",
    async (request, reply) => {
      const sessionId = request.body.sessionId?.trim();
      const message = request.body.message?.trim();

      if (!sessionId || !message) {
        return reply.status(400).send({ error: "sessionId 与 message 不能为空" });
      }
      if (!isLlmConfigured()) {
        return reply.status(503).send({ error: "请先在根目录 .env 配置 OPENAI_API_KEY" });
      }

      try {
        const { reply: text, messageCount } = await runMemoryChat(sessionId, message);
        return { reply: text, sessionId, messageCount };
      } catch (err) {
        request.log.error(err, "memory-chat failed");
        return reply.status(502).send({ error: "Memory 对话失败" });
      }
    },
  );

  app.post<{ Body: MemoryResetRequest; Reply: MemoryResetResponse }>(
    "/api/learning/memory-reset",
    async (request) => {
      const sessionId = request.body.sessionId?.trim();
      if (sessionId) resetMemorySession(sessionId);
      return { ok: true, sessionId: sessionId ?? "" };
    },
  );

  app.post<{
    Body: LangGraphWorkflowRequest;
    Reply: LangGraphWorkflowResponse | { error: string };
  }>("/api/learning/langgraph-workflow", async (request, reply) => {
    const input = request.body.input?.trim();
    if (!input) {
      return reply.status(400).send({ error: "input 不能为空" });
    }

    try {
      return await runMathWorkflow(input);
    } catch (err) {
      request.log.error(err, "langgraph-workflow failed");
      return reply.status(400).send({ error: "LangGraph 工作流执行失败" });
    }
  });

  app.post<{
    Body: LangGraphRouterRequest;
    Reply: LangGraphRouterResponse | { error: string };
  }>("/api/learning/langgraph-router", async (request, reply) => {
    const input = request.body.input?.trim();
    if (!input) {
      return reply.status(400).send({ error: "input 不能为空" });
    }

    try {
      return await runThreeNodeRouter(input);
    } catch (err) {
      request.log.error(err, "langgraph-router failed");
      return reply.status(400).send({ error: "LangGraph 三节点图执行失败" });
    }
  });

  app.post<{
    Body: WeatherCompareRequest;
    Reply: WeatherCompareResponse | { error: string };
  }>("/api/learning/weather-agent", async (request, reply) => {
    const question = request.body.question?.trim();
    if (!question) {
      return reply.status(400).send({ error: "question 不能为空" });
    }

    try {
      return await runWeatherCompareAgent(question);
    } catch (err) {
      request.log.error(err, "weather-agent failed");
      return reply.status(400).send({ error: "天气 Agent 执行失败" });
    }
  });
};
