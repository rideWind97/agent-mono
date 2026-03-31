import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { allTools } from "../tools/index.js";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AgentBody {
  messages: ChatMessage[];
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function agentRoutes(app: FastifyInstance) {
  /**
   * POST /api/agent/chat
   * SSE streaming agent endpoint
   */
  app.post<{ Body: AgentBody }>("/api/agent/chat", async (request, reply) => {
    const {
      messages,
      model = "gpt-4o-mini",
      apiKey,
      baseUrl,
      temperature = 0.7,
      maxTokens = 2048,
    } = request.body;

    const resolvedApiKey = apiKey || config.openaiApiKey;
    const resolvedBaseUrl = baseUrl || config.openaiBaseUrl;

    if (!resolvedApiKey) {
      return reply.status(400).send({ error: "API Key is required. Set OPENAI_API_KEY or pass apiKey in body." });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const abortController = new AbortController();
    let clientDisconnected = false;

    request.raw.on("close", () => {
      clientDisconnected = true;
      abortController.abort();
    });

    // 3-minute timeout
    const timeoutId = setTimeout(() => {
      if (!clientDisconnected) {
        abortController.abort();
      }
    }, 3 * 60 * 1000);

    try {
      const llm = new ChatOpenAI({
        model,
        apiKey: resolvedApiKey,
        configuration: { baseURL: resolvedBaseUrl },
        temperature,
        maxTokens,
        streaming: true,
      });

      const agent = createReactAgent({ llm, tools: allTools });

      const langchainMessages = messages.map((m) => {
        if (m.role === "system") return new SystemMessage(m.content);
        return new HumanMessage(m.content);
      });

      const eventStream = agent.streamEvents(
        { messages: langchainMessages },
        { version: "v2", signal: abortController.signal, recursionLimit: 15 },
      );

      for await (const event of eventStream) {
        if (clientDisconnected) break;

        if (event.event === "on_tool_start") {
          const data = JSON.stringify({
            type: "tool_start",
            tool: event.name,
            input: event.data?.input,
          });
          reply.raw.write(`data: ${data}\n\n`);
        }

        if (event.event === "on_tool_end") {
          const rawOutput = event.data?.output;
          const output =
            typeof rawOutput === "string"
              ? rawOutput
              : typeof rawOutput?.content === "string"
                ? rawOutput.content
                : JSON.stringify(rawOutput);

          const data = JSON.stringify({
            type: "tool_end",
            tool: event.name,
            output,
          });
          reply.raw.write(`data: ${data}\n\n`);
        }

        if (event.event === "on_chat_model_stream") {
          const rawContent = event.data?.chunk?.content;
          let textContent = "";

          if (typeof rawContent === "string") {
            textContent = rawContent;
          } else if (Array.isArray(rawContent)) {
            for (const part of rawContent) {
              if (typeof part === "string") {
                textContent += part;
              } else if (part?.type === "text" && typeof part.text === "string") {
                textContent += part.text;
              }
            }
          }

          if (textContent) {
            const data = JSON.stringify({
              type: "token",
              content: textContent,
            });
            reply.raw.write(`data: ${data}\n\n`);
          }
        }
      }

      if (!clientDisconnected) {
        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
      }
    } catch (error) {
      if (clientDisconnected) return;

      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("Recursion")) {
        reply.raw.write(
          `data: ${JSON.stringify({ type: "error", message: "Agent 工具调用次数超限，请简化问题后重试" })}\n\n`,
        );
        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
        return;
      }

      console.error("[Agent] stream error:", error);
      reply.raw.write(
        `data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`,
      );
      reply.raw.write("data: [DONE]\n\n");
      reply.raw.end();
    } finally {
      clearTimeout(timeoutId);
    }
  });

  /**
   * GET /api/agent/tools
   * List available tools
   */
  app.get("/api/agent/tools", async () => {
    return {
      tools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    };
  });
}
