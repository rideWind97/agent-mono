import type { ServerResponse } from "node:http";

import type { FastifyInstance } from "fastify";
import OpenAI from "openai";

import { config } from "../config.js";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatBody {
  messages: ChatMessage[];
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Ensure the base URL ends with `/v1` (or similar versioned path).
 * The OpenAI SDK appends `/chat/completions` directly to the baseURL.
 *   https://api.deepseek.com  →  https://api.deepseek.com/v1
 *   https://api.openai.com    →  https://api.openai.com/v1
 *   https://api.openai.com/v1 →  https://api.openai.com/v1  (no change)
 */
function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, ""); // strip trailing slashes
  // Already has a versioned path like /v1, /v2, /v4, etc.
  if (/\/v\d+$/.test(trimmed)) return trimmed;
  // Special case: 智谱 already has /api/paas/v4
  if (/\/v\d+\//.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

export async function chatRoutes(app: FastifyInstance) {
  /**
   * POST /api/chat
   * Simple LLM chat with SSE streaming — no agent, no tools.
   * Uses the OpenAI SDK directly for maximum reliability.
   */
  app.post<{ Body: ChatBody }>("/api/chat", async (request, reply) => {
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

    console.log("[Chat] === New Request ===");
    console.log("[Chat] model:", model);
    console.log("[Chat] baseUrl (raw):", rawBaseUrl);
    console.log("[Chat] baseUrl (resolved):", resolvedBaseUrl);
    console.log("[Chat] messageCount:", messages.length);
    console.log("[Chat] hasApiKey:", !!resolvedApiKey);

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

    let clientDisconnected = false;

    request.raw.on("close", () => {
      clientDisconnected = true;
    });

    try {
      // Use the OpenAI SDK directly — much more reliable than LangChain for
      // simple streaming chat.
      const client = new OpenAI({
        apiKey: resolvedApiKey,
        baseURL: resolvedBaseUrl,
        timeout: 60_000, // 60s connection timeout
      });

      console.log("[Chat] Starting OpenAI stream...");

      const stream = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      console.log("[Chat] Stream created, reading chunks...");

      for await (const chunk of stream) {
        if (clientDisconnected) {
          // Cancel the stream if client disconnected
          stream.controller.abort();
          break;
        }

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          sseWrite(reply.raw, JSON.stringify({ type: "token", content: delta.content }));
        }
      }

      console.log("[Chat] Stream finished");

      if (!clientDisconnected) {
        sseDone(reply.raw);
      }
    } catch (error) {
      if (clientDisconnected) return;

      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[Chat] Error:", errMsg);

      // Try to provide a user-friendly error message
      if (errMsg.includes("401") || errMsg.includes("Unauthorized") || errMsg.includes("auth")) {
        sseError(reply.raw, "API Key 无效或已过期，请检查配置");
      } else if (errMsg.includes("404") || errMsg.includes("not found")) {
        sseError(reply.raw, `模型 "${model}" 不存在或 baseURL 配置错误`);
      } else if (errMsg.includes("429") || errMsg.includes("rate")) {
        sseError(reply.raw, "请求频率超限，请稍后重试");
      } else if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT") || errMsg.includes("ECONNREFUSED")) {
        sseError(reply.raw, "连接 LLM 服务超时，请检查网络或 baseURL 配置");
      } else {
        sseError(reply.raw, errMsg);
      }
    }
  });
}
