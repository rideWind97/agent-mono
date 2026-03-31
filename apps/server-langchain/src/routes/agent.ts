import type { ServerResponse } from "node:http";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
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

/**
 * Ensure the base URL ends with `/v1` (or similar versioned path).
 * LangChain's ChatOpenAI uses the OpenAI SDK under the hood, which
 * appends `/chat/completions` directly to the baseURL.
 */
function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  if (/\/v\d+$/.test(trimmed)) return trimmed;
  if (/\/v\d+\//.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

/* ------------------------------------------------------------------ */
/*  SSE helpers                                                        */
/* ------------------------------------------------------------------ */

function sseWrite(raw: ServerResponse, data: string) {
  raw.write(`data: ${data}\n\n`);
}

function sseDone(raw: ServerResponse) {
  raw.write("data: [DONE]\n\n");
  raw.end();
}

function sseError(raw: ServerResponse, message: string) {
  sseWrite(raw, JSON.stringify({ type: "error", message }));
  sseDone(raw);
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

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
    const rawBaseUrl = baseUrl || config.openaiBaseUrl;
    const resolvedBaseUrl = normalizeBaseUrl(rawBaseUrl);

    console.log("[Agent] === New Request ===");
    console.log("[Agent] model:", model);
    console.log("[Agent] baseUrl (raw):", rawBaseUrl);
    console.log("[Agent] baseUrl (resolved):", resolvedBaseUrl);
    console.log("[Agent] messageCount:", messages.length);
    console.log("[Agent] hasApiKey:", !!resolvedApiKey);

    if (!resolvedApiKey) {
      return reply
        .status(400)
        .send({ error: "API Key is required. Set OPENAI_API_KEY or pass apiKey in body." });
    }

    if (!messages.length) {
      return reply.status(400).send({ error: "messages array is empty." });
    }

    // --- Tell Fastify we're taking over the response ---
    reply.hijack();

    // --- Set SSE headers ---
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

    const timeoutId = setTimeout(() => {
      if (!clientDisconnected) {
        console.warn("[Agent] Request timed out after 3 minutes");
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
        if (m.role === "assistant") return new AIMessage(m.content);
        return new HumanMessage(m.content);
      });

      // -----------------------------------------------------------------
      // Use streamEvents v2.
      //
      // KNOWN ISSUE: streamEvents can silently swallow LLM errors (e.g.
      // 401 auth failures) — the stream simply ends with 0 useful events.
      // We detect this case and fall back to a direct llm.invoke to
      // surface the actual error message to the user.
      // -----------------------------------------------------------------
      console.log("[Agent] Starting streamEvents...");
      const eventStream = agent.streamEvents(
        { messages: langchainMessages },
        { version: "v2", signal: abortController.signal, recursionLimit: 15 },
      );

      let hasContent = false;

      for await (const event of eventStream) {
        if (clientDisconnected) break;

        // --- tool_start ---
        if (event.event === "on_tool_start") {
          sseWrite(
            reply.raw,
            JSON.stringify({
              type: "tool_start",
              tool: event.name,
              input: event.data?.input,
            }),
          );
        }

        // --- tool_end ---
        if (event.event === "on_tool_end") {
          const rawOutput = event.data?.output;
          const output =
            typeof rawOutput === "string"
              ? rawOutput
              : typeof rawOutput?.content === "string"
                ? rawOutput.content
                : JSON.stringify(rawOutput);

          sseWrite(
            reply.raw,
            JSON.stringify({ type: "tool_end", tool: event.name, output }),
          );
        }

        // --- token streaming ---
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
            hasContent = true;
            sseWrite(reply.raw, JSON.stringify({ type: "token", content: textContent }));
          }
        }
      }

      // ---------------------------------------------------------------
      // If streamEvents produced ZERO content, the LLM call likely
      // failed silently. Do a direct invoke to surface the real error.
      // ---------------------------------------------------------------
      if (!hasContent && !clientDisconnected) {
        console.warn("[Agent] streamEvents produced no content — probing LLM for real error...");
        try {
          await llm.invoke([new HumanMessage("hi")]);
          // If this succeeds, the LLM works but the agent produced nothing
          sseWrite(
            reply.raw,
            JSON.stringify({
              type: "error",
              message: "Agent 未返回任何内容，请检查模型配置或稍后重试",
            }),
          );
        } catch (probeError) {
          const probeMsg = probeError instanceof Error ? probeError.message : String(probeError);
          console.error("[Agent] LLM probe error:", probeMsg);
          sseWrite(
            reply.raw,
            JSON.stringify({
              type: "error",
              message: `LLM 连接失败: ${probeMsg}`,
            }),
          );
        }
      }

      if (!clientDisconnected) {
        sseDone(reply.raw);
      }
    } catch (error) {
      if (clientDisconnected) return;

      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[Agent] stream error:", errMsg);

      if (errMsg.includes("Recursion")) {
        sseError(reply.raw, "Agent 工具调用次数超限，请简化问题后重试");
      } else {
        sseError(reply.raw, errMsg);
      }
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
