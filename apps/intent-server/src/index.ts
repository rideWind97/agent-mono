/**
 * Intent Server — 入口文件
 *
 * 从 0 到 1 手写意图识别服务，不用任何 LangChain 代码
 *
 * API 端点：
 * - POST /api/intent/recognize  — 单轮意图识别
 * - POST /api/intent/fill-slot  — 多轮槽位补全
 * - GET  /api/intent/list       — 列出所有已注册意图
 * - GET  /api/intent/health     — 健康检查
 */
import cors from "@fastify/cors";
import Fastify from "fastify";

import { config } from "./config.js";
import { dispatch } from "./dispatcher.js";
import { INTENT_REGISTRY, findIntent } from "./intents.js";
import type { LLMCallOptions } from "./llm.js";
import { chat } from "./llm.js";
import { parseIntentResult } from "./parser.js";
import { buildSystemPrompt } from "./prompt.js";
import {
  createSession,
  getSession,
  deleteSession,
  generateFollowUp,
  processUserReply,
} from "./slot-filler.js";

const app = Fastify({ logger: true });

function sseWrite(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function sseDone() {
  return "data: [DONE]\n\n";
}

async function writeTokenStream(
  raw: NodeJS.WritableStream,
  text: string,
  chunkSize = 20,
): Promise<void> {
  for (let i = 0; i < text.length; i += chunkSize) {
    raw.write(sseWrite({ type: "token", content: text.slice(i, i + chunkSize) }));
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
}

function formatIntentSummary(payload: {
  status: string;
  intent: string;
  confidence?: number;
  slots: Record<string, unknown>;
  missingSlots: string[];
  followUp?: string;
  result?: { message?: string };
}) {
  const confidence = typeof payload.confidence === "number"
    ? `${Math.round(payload.confidence * 100)}%`
    : "-";

  let summary = "意图识别完成。";
  if (payload.status === "need_more_info") {
    summary = payload.followUp || "请补充更多信息。";
  } else if (payload.status === "completed") {
    summary = payload.result?.message || "意图执行完成。";
  }

  const missingText = payload.missingSlots.length
    ? `\n\n缺失槽位：${payload.missingSlots.map((slot) => `\`${slot}\``).join("、")}`
    : "";

  return [
    summary,
    "",
    `- 意图：\`${payload.intent}\``,
    `- 置信度：\`${confidence}\``,
    `- 状态：\`${payload.status}\``,
    missingText ? `${missingText}` : "",
    "",
    "```json",
    JSON.stringify(payload.slots, null, 2),
    "```",
  ].filter(Boolean).join("\n");
}

// ─── CORS ────────────────────────────────────────────────
await app.register(cors, { origin: true });

// ─── 健康检查 ─────────────────────────────────────────────
app.get("/api/intent/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// ─── 列出所有意图 ─────────────────────────────────────────
app.get("/api/intent/list", async () => {
  return {
    intents: INTENT_REGISTRY.map((i) => ({
      name: i.name,
      description: i.description,
      examples: i.examples,
      slots: i.slots.map((s) => ({
        name: s.name,
        type: s.type,
        description: s.description,
        required: s.required,
        enumValues: s.enumValues,
      })),
    })),
  };
});

// ─── 意图识别请求体 ──────────────────────────────────────
interface RecognizeBody {
  message: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  /** 是否自动执行工具，默认 true */
  autoDispatch?: boolean;
}

async function handleRecognize(body: RecognizeBody) {
  const {
    message, model, apiKey, baseUrl, autoDispatch = true,
  } = body;

  if (!message?.trim()) {
    return { error: "message is required" };
  }

  const llmOptions: LLMCallOptions = { model, apiKey, baseUrl };
  const systemPrompt = buildSystemPrompt();
  const llmResult = await chat(systemPrompt, message, llmOptions);
  const parsed = parseIntentResult(llmResult.content);

  if (parsed.missingSlots.length > 0) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const session = createSession(
      sessionId,
      parsed.intent,
      parsed.slots,
      parsed.missingSlots,
    );
    const followUp = await generateFollowUp(session, llmOptions);

    return {
      status: "need_more_info" as const,
      intent: parsed.intent,
      confidence: parsed.confidence,
      slots: parsed.slots,
      missingSlots: parsed.missingSlots,
      sessionId,
      followUp,
      llmRaw: llmResult.content,
      usage: llmResult.usage,
    };
  }

  if (parsed.intent === "chitchat") {
    const chitchatResult = await chat(
      "你是一个友好的中文助手。请自然地回复用户。",
      message,
      llmOptions,
    );

    return {
      status: "completed" as const,
      intent: parsed.intent,
      confidence: parsed.confidence,
      slots: parsed.slots,
      missingSlots: [],
      result: {
        success: true,
        intent: "chitchat",
        slots: {},
        result: { reply: chitchatResult.content },
        message: chitchatResult.content,
      },
      llmRaw: llmResult.content,
      usage: llmResult.usage,
    };
  }

  if (autoDispatch) {
    const intentDef = findIntent(parsed.intent);
    if (intentDef) {
      for (const slot of intentDef.slots) {
        if (
          slot.defaultValue !== undefined &&
          parsed.slots[slot.name] === undefined
        ) {
          parsed.slots[slot.name] = slot.defaultValue;
        }
      }
    }

    const dispatchResult = await dispatch(parsed.intent, parsed.slots);

    return {
      status: "completed" as const,
      intent: parsed.intent,
      confidence: parsed.confidence,
      slots: parsed.slots,
      missingSlots: [],
      result: dispatchResult,
      llmRaw: llmResult.content,
      usage: llmResult.usage,
    };
  }

  return {
    status: "ready" as const,
    intent: parsed.intent,
    confidence: parsed.confidence,
    slots: parsed.slots,
    missingSlots: [],
    llmRaw: llmResult.content,
    usage: llmResult.usage,
  };
}

// ─── 单轮意图识别 ─────────────────────────────────────────
app.post<{ Body: RecognizeBody }>("/api/intent/recognize", async (request) => {
  return handleRecognize(request.body);
});

// ─── 多轮槽位补全请求体 ──────────────────────────────────
interface FillSlotBody {
  sessionId: string;
  message: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

async function handleFillSlot(body: FillSlotBody) {
  const {
    sessionId, message, model, apiKey, baseUrl,
  } = body;

  if (!sessionId || !message?.trim()) {
    return { error: "sessionId and message are required" };
  }

  const session = getSession(sessionId);
  if (!session) {
    return { error: `Session not found: ${sessionId}` };
  }

  const llmOptions: LLMCallOptions = { model, apiKey, baseUrl };
  const fillResult = await processUserReply(session, message, llmOptions);

  if (!fillResult.isComplete) {
    const followUp = await generateFollowUp(session, llmOptions);

    return {
      status: "need_more_info" as const,
      intent: session.intentName,
      slots: session.filledSlots,
      newSlots: fillResult.newSlots,
      missingSlots: fillResult.stillMissing,
      sessionId,
      followUp,
    };
  }

  const dispatchResult = await dispatch(session.intentName, session.filledSlots);
  deleteSession(sessionId);

  return {
    status: "completed" as const,
    intent: session.intentName,
    slots: session.filledSlots,
    newSlots: fillResult.newSlots,
    missingSlots: [],
    result: dispatchResult,
  };
}

// ─── 多轮槽位补全 ─────────────────────────────────────────
app.post<{ Body: FillSlotBody }>("/api/intent/fill-slot", async (request) => {
  return handleFillSlot(request.body);
});

app.post<{
  Body: {
    message: string;
    sessionId?: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    autoDispatch?: boolean;
  };
}>("/api/intent/stream", async (request, reply) => {
  const {
    message, sessionId, model, apiKey, baseUrl, autoDispatch,
  } = request.body;

  if (!message?.trim()) {
    return reply.status(400).send({ error: "message is required" });
  }

  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const payload = sessionId
      ? await handleFillSlot({
          sessionId,
          message,
          model,
          apiKey,
          baseUrl,
        })
      : await handleRecognize({
          message,
          model,
          apiKey,
          baseUrl,
          autoDispatch,
        });

    if ("error" in payload) {
      reply.raw.write(sseWrite({ type: "error", message: payload.error }));
      reply.raw.write(sseDone());
      reply.raw.end();
      return;
    }

    await writeTokenStream(
      reply.raw,
      formatIntentSummary({
        status: payload.status,
        intent: payload.intent,
        confidence: "confidence" in payload ? payload.confidence : undefined,
        slots: payload.slots,
        missingSlots: payload.missingSlots,
        followUp: "followUp" in payload ? payload.followUp : undefined,
        result: "result" in payload ? payload.result : undefined,
      }),
    );

    reply.raw.write(sseWrite({ type: "meta", ...payload }));
    reply.raw.write(sseDone());
    reply.raw.end();
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    reply.raw.write(sseWrite({ type: "error", message: messageText }));
    reply.raw.write(sseDone());
    reply.raw.end();
  }
});

// ─── 启动服务器 ──────────────────────────────────────────
try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`🧠 Intent Server is running on http://localhost:${config.port}`);
  console.log(`📋 Registered intents: ${INTENT_REGISTRY.map((i) => i.name).join(", ")}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
