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
  provider?: "openai" | "gemini";
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
  return trimmed;
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
      provider,
    } = request.body;

    const isGemini = provider === "gemini" || model.startsWith("gemini-");
    const geminiCompatibleBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

    const resolvedApiKey = isGemini
      ? (apiKey || config.googleApiKey)
      : (apiKey || config.openaiApiKey);
    const rawBaseUrl = isGemini
      ? (baseUrl || geminiCompatibleBaseUrl)
      : (baseUrl || config.openaiBaseUrl);
    const resolvedBaseUrl = normalizeBaseUrl(rawBaseUrl);

    console.log("[Agent] === New Request ===");
    console.log("[Agent] provider:", isGemini ? "gemini" : "openai-compatible");
    console.log("[Agent] model:", model);
    console.log("[Agent] baseUrl (raw):", rawBaseUrl);
    console.log("[Agent] baseUrl (resolved):", resolvedBaseUrl);
    console.log("[Agent] messageCount:", messages.length);
    console.log("[Agent] hasApiKey:", !!resolvedApiKey);

    if (!resolvedApiKey) {
      const envHint = isGemini ? "GOOGLE_API_KEY" : "OPENAI_API_KEY";
      return reply
        .status(400)
        .send({ error: `API Key is required. Set ${envHint} or pass apiKey in body.` });
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

    // IMPORTANT:
    // request.raw "close" can fire once request body is fully consumed,
    // which does NOT mean the SSE client disconnected.
    // Use "aborted" to detect client-side cancellation.
    request.raw.on("aborted", () => {
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

        // Some providers may only provide content in "end" events.
        // Use this as a fallback to avoid duplicating already streamed tokens.
        if (event.event === "on_chat_model_end" && !hasContent) {
          const rawContent = event.data?.output?.content;
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
      // If streamEvents produced ZERO content, fail fast so the client
      // gets immediate feedback instead of waiting for a second probe call.
      // ---------------------------------------------------------------
      if (!hasContent && !clientDisconnected) {
        console.warn("[Agent] streamEvents produced no content.");
        sseWrite(
          reply.raw,
          JSON.stringify({
            type: "error",
            message: "Agent 未返回内容，请检查模型/API Key/Base URL 配置",
          }),
        );
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
