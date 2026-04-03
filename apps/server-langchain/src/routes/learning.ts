import type { ServerResponse } from "node:http";

import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type { FastifyInstance } from "fastify";
import OpenAI from "openai";

import { config } from "../config.js";

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

async function sseWriteText(raw: ServerResponse, text: string, chunkSize = 24) {
  for (let i = 0; i < text.length; i += chunkSize) {
    sseWrite(raw, JSON.stringify({ type: "token", content: text.slice(i, i + chunkSize) }));
    await wait(12);
  }
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  if (/\/v\d+$/.test(trimmed)) return trimmed;
  if (/\/v\d+\//.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

function inferDefaultModel(baseUrl: string): string {
  const normalized = baseUrl.toLowerCase();
  if (normalized.includes("deepseek")) return "deepseek-chat";
  if (normalized.includes("bigmodel")) return "glm-4-flash";
  if (normalized.includes("generativelanguage.googleapis.com")) return "gemini-2.0-flash";
  return "gpt-4o-mini";
}

function createModel(params?: {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
}) {
  const resolvedApiKey = params?.apiKey || config.openaiApiKey;
  if (!resolvedApiKey) {
    throw new Error("API Key is required. Set OPENAI_API_KEY or pass apiKey in body.");
  }
  const resolvedBaseUrl = normalizeBaseUrl(params?.baseUrl || config.openaiBaseUrl);
  const resolvedModel = params?.model || inferDefaultModel(resolvedBaseUrl);

  return new ChatOpenAI({
    model: resolvedModel,
    apiKey: resolvedApiKey,
    configuration: { baseURL: resolvedBaseUrl },
    temperature: params?.temperature ?? 0.3,
  });
}

function createOpenAIClient(params?: {
  apiKey?: string;
  baseUrl?: string;
}) {
  const resolvedApiKey = params?.apiKey || config.openaiApiKey;
  if (!resolvedApiKey) {
    throw new Error("API Key is required. Set OPENAI_API_KEY or pass apiKey in body.");
  }
  const resolvedBaseUrl = normalizeBaseUrl(params?.baseUrl || config.openaiBaseUrl);
  return {
    client: new OpenAI({
      apiKey: resolvedApiKey,
      baseURL: resolvedBaseUrl,
    }),
    resolvedBaseUrl,
  };
}

const SAFE_CITIES = new Set(["北京", "上海", "广州", "深圳", "杭州", "成都"]);
const CITY_TIMEZONE: Record<string, string> = {
  北京: "Asia/Shanghai",
  上海: "Asia/Shanghai",
  广州: "Asia/Shanghai",
  深圳: "Asia/Shanghai",
  杭州: "Asia/Shanghai",
  成都: "Asia/Shanghai",
};
const WEATHER_DB: Record<string, { condition: string; tempC: number; humidity: number }> = {
  北京: { condition: "晴", tempC: 21, humidity: 35 },
  上海: { condition: "多云", tempC: 24, humidity: 62 },
  广州: { condition: "阵雨", tempC: 28, humidity: 81 },
  深圳: { condition: "雷阵雨", tempC: 29, humidity: 84 },
  杭州: { condition: "阴", tempC: 23, humidity: 59 },
  成都: { condition: "小雨", tempC: 20, humidity: 78 },
};

function assertSafeCity(cityRaw: string): string {
  const city = cityRaw.trim();
  if (!SAFE_CITIES.has(city)) {
    throw new Error(`不支持的城市: ${city}。仅支持: ${Array.from(SAFE_CITIES).join("、")}`);
  }
  return city;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, retries = 3): Promise<T> {
  const delays = [200, 500, 1000];
  let lastError: unknown = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) await wait(delays[i] || 1000);
    }
  }
  throw new Error(`${label} 失败: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function getWeather(cityRaw: string, date?: string) {
  const city = assertSafeCity(cityRaw);
  const data = WEATHER_DB[city];
  if (!data) {
    throw new Error(`weather db 中不存在城市: ${city}`);
  }
  return {
    city,
    date: date || "today",
    ...data,
    source: "mock-weather-db",
  };
}

async function getCurrentTime(cityRaw: string) {
  const city = assertSafeCity(cityRaw);
  const tz = CITY_TIMEZONE[city] || "Asia/Shanghai";
  return {
    city,
    timezone: tz,
    time: new Intl.DateTimeFormat("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: tz,
    }).format(new Date()),
  };
}

async function getClothingAdvice(tempDiff: number, weatherSummary: string) {
  const level = Math.abs(tempDiff) >= 8 ? "温差大，建议分层穿搭" : "温差适中，可按常规穿搭";
  return {
    tempDiff,
    weatherSummary,
    advice: `${level}；天气概况：${weatherSummary}`,
  };
}

interface RagDoc {
  id: string;
  title: string;
  text: string;
}

interface RagChunk {
  id: string;
  docId: string;
  text: string;
}

const RAG_CORPUS: RagDoc[] = [
  {
    id: "rag-core",
    title: "RAG Core",
    text: "RAG 由检索与生成组成。先检索相关上下文，再基于证据生成回答。它可显著降低幻觉并提升可解释性。",
  },
  {
    id: "rag-metrics",
    title: "RAG Metrics",
    text: "RAG 常见评估指标包括 Faithfulness、Relevancy、Context Recall。Faithfulness 强调答案是否忠实于证据。",
  },
  {
    id: "rag-opt",
    title: "RAG Optimization",
    text: "RAG 优化手段包括 Query Expansion、Hybrid Search、MMR 和 Re-ranking。Hybrid Search 结合关键词匹配与向量语义检索。",
  },
];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

function sentenceChunkDocs(docs: RagDoc[]): RagChunk[] {
  const chunks: RagChunk[] = [];
  for (const doc of docs) {
    const sentences = doc.text.split(/(?<=[。！？.!?])/).map((x) => x.trim()).filter(Boolean);
    for (let i = 0; i < sentences.length; i += 1) {
      const sentence = sentences[i];
      if (!sentence) continue;
      chunks.push({
        id: `${doc.id}-${i}`,
        docId: doc.id,
        text: sentence,
      });
    }
  }
  return chunks;
}

function keywordScore(query: string, text: string): number {
  const q = new Set(tokenize(query));
  const t = new Set(tokenize(text));
  if (!q.size) return 0;
  let hit = 0;
  for (const w of q) if (t.has(w)) hit += 1;
  return hit / q.size;
}

function expandRagQuery(query: string): string[] {
  const out = new Set<string>([query]);
  const lowered = query.toLowerCase();
  if (lowered.includes("评估")) {
    out.add(`${query} faithfulness`);
    out.add(`${query} context recall`);
  }
  if (lowered.includes("优化")) {
    out.add(`${query} hybrid search`);
    out.add(`${query} re-ranking`);
  }
  if (lowered.includes("rag")) {
    out.add(`${query} retrieval augmented generation`);
  }
  return Array.from(out);
}

function simpleRerank(query: string, items: Array<{ chunk: RagChunk; score: number }>, topK = 4) {
  return items
    .map((x) => ({
      ...x,
      score: x.score * 0.7 + keywordScore(query, x.chunk.text) * 0.4,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

const memoryStore = new Map<string, InMemoryChatMessageHistory>();

function getSessionHistory(sessionId: string): InMemoryChatMessageHistory {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, new InMemoryChatMessageHistory());
  }
  return memoryStore.get(sessionId)!;
}

function evaluateExpression(input: string): number | null {
  if (!/^[\d+\-*/().%\s]+$/.test(input)) return null;
  try {
    const result = new Function(`"use strict"; return (${input})`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

const WorkflowState = Annotation.Root({
  input: Annotation<string>(),
  intent: Annotation<"math" | "general">(),
  plan: Annotation<string>(),
  draft: Annotation<string>(),
  output: Annotation<string>(),
  steps: Annotation<Array<{ node: string; detail: string }>>(),
});

export async function learningRoutes(app: FastifyInstance) {
  /**
   * 任务 1: 带记忆对话机器人
   * POST /api/learning/memory-chat
   */
  app.post<{
    Body: {
      sessionId: string;
      input: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
    };
  }>("/api/learning/memory-chat", async (request, reply) => {
    const { sessionId, input, model, apiKey, baseUrl } = request.body;
    if (!sessionId?.trim()) {
      return reply.status(400).send({ error: "sessionId is required" });
    }
    if (!input?.trim()) {
      return reply.status(400).send({ error: "input is required" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    let clientDisconnected = false;
    request.raw.on("aborted", () => {
      clientDisconnected = true;
    });

    try {
      const llm = createModel({ model, apiKey, baseUrl });
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", "你是一个有长期上下文记忆的助手，请结合历史对话来回答。"],
        new MessagesPlaceholder("history"),
        ["human", "{input}"],
      ]);
      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const chainWithHistory = new RunnableWithMessageHistory({
        runnable: chain,
        getMessageHistory: (sid) => getSessionHistory(String(sid)),
        inputMessagesKey: "input",
        historyMessagesKey: "history",
      });

      const stream = await chainWithHistory.stream(
        { input },
        { configurable: { sessionId } },
      );

      let hasToken = false;
      for await (const chunk of stream) {
        if (clientDisconnected) break;
        const token = typeof chunk === "string" ? chunk : String(chunk ?? "");
        if (!token) continue;
        hasToken = true;
        sseWrite(reply.raw, JSON.stringify({ type: "token", content: token }));
      }

      if (!clientDisconnected) {
        const history = await getSessionHistory(sessionId).getMessages();
        sseWrite(
          reply.raw,
          JSON.stringify({
            type: "meta",
            sessionId,
            historyCount: history.length,
            hasToken,
          }),
        );
        sseDone(reply.raw);
      }
    } catch (error) {
      if (clientDisconnected) return;
      const message = error instanceof Error ? error.message : String(error);
      sseError(reply.raw, message);
    }
  });

  app.post<{
    Body: {
      task: "lcel" | "workflow" | "functionCall" | "rag";
      input: string;
      tone?: "简洁" | "专业" | "口语化";
      model?: string;
      apiKey?: string;
      baseUrl?: string;
      topK?: number;
    };
  }>("/api/learning/stream", async (request, reply) => {
    const {
      task, input, tone = "简洁", model, apiKey, baseUrl, topK = 4,
    } = request.body;

    if (!input?.trim()) {
      return reply.status(400).send({ error: "input is required" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    let clientDisconnected = false;
    request.raw.on("aborted", () => {
      clientDisconnected = true;
    });

    try {
      if (task === "lcel") {
        const llm = createModel({ model, apiKey, baseUrl });
        const prompt = ChatPromptTemplate.fromTemplate(
          "请用{tone}风格，围绕“{topic}”输出 3 条要点，每条不超过 20 字。",
        );
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        const stream = await chain.stream({ topic: input.trim(), tone });
        for await (const chunk of stream) {
          if (clientDisconnected) break;
          const token = typeof chunk === "string" ? chunk : String(chunk ?? "");
          if (!token) continue;
          sseWrite(reply.raw, JSON.stringify({ type: "token", content: token }));
        }
        if (!clientDisconnected) {
          sseWrite(reply.raw, JSON.stringify({ type: "meta", task }));
          sseDone(reply.raw);
        }
        return;
      }

      if (task === "workflow") {
        const llm = createModel({ model, apiKey, baseUrl });
        await sseWriteText(reply.raw, `### Workflow 开始\n\n输入：${input.trim()}\n\n`);
        const maybeMath = evaluateExpression(input.trim());
        const intent = maybeMath !== null ? "math" : "general";
        await sseWriteText(reply.raw, `1. classify：识别任务类型为 \`${intent}\`\n`);
        const plan = intent === "math"
          ? "执行数学计算 -> 组织结果说明"
          : "生成简明回答 -> 组织结果说明";
        await sseWriteText(reply.raw, `2. makePlan：${plan}\n`);

        let draft = "";
        if (intent === "math") {
          draft = maybeMath === null ? "无法解析为数学表达式。" : `计算结果: ${maybeMath}`;
          await sseWriteText(reply.raw, `3. solveMath：${draft}\n`);
        } else {
          await sseWriteText(reply.raw, "3. generalAnswer：正在生成回答...\n");
          const prompt = ChatPromptTemplate.fromTemplate(
            "请对下面输入给出简明回答：\n{input}",
          );
          const stream = await prompt.pipe(llm).pipe(new StringOutputParser()).stream({
            input: input.trim(),
          });
          let answer = "";
          for await (const chunk of stream) {
            if (clientDisconnected) break;
            const token = typeof chunk === "string" ? chunk : String(chunk ?? "");
            if (!token) continue;
            answer += token;
          }
          draft = answer;
          await sseWriteText(reply.raw, `3. generalAnswer：${draft}\n`);
        }

        await sseWriteText(reply.raw, `4. finalize：Workflow 完成（${intent}）: ${draft}`);
        if (!clientDisconnected) {
          sseWrite(reply.raw, JSON.stringify({ type: "meta", task, intent, plan }));
          sseDone(reply.raw);
        }
        return;
      }

      if (task === "functionCall") {
        const { client, resolvedBaseUrl } = createOpenAIClient({ apiKey, baseUrl });
        const resolvedModel = model || inferDefaultModel(resolvedBaseUrl);
        await sseWriteText(reply.raw, "### Function Calling 过程\n\n");

        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "查询某城市天气（教学 mock 数据）",
              parameters: {
                type: "object",
                properties: {
                  city: { type: "string", description: "城市名，如 北京" },
                  date: { type: "string", description: "日期，如 today/2026-04-01" },
                },
                required: ["city"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function",
            function: {
              name: "get_current_time",
              description: "查询某城市当前时间",
              parameters: {
                type: "object",
                properties: {
                  city: { type: "string", description: "城市名，如 上海" },
                },
                required: ["city"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function",
            function: {
              name: "get_clothing_advice",
              description: "根据温差和天气概况生成穿衣建议",
              parameters: {
                type: "object",
                properties: {
                  tempDiff: { type: "number", description: "两地温差（摄氏度）" },
                  weatherSummary: { type: "string", description: "天气摘要文本" },
                },
                required: ["tempDiff", "weatherSummary"],
                additionalProperties: false,
              },
            },
          },
        ];

        const initialMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          {
            role: "system",
            content:
              "你是天气助理。优先调用工具；如果涉及两个城市，尽量并行调用工具。拿到工具结果后再给最终结论。不要编造工具结果。",
          },
          { role: "user", content: input.trim() },
        ];

        const first = await client.chat.completions.create({
          model: resolvedModel,
          messages: initialMessages,
          tools,
          tool_choice: "auto",
          parallel_tool_calls: true,
          temperature: 0.2,
        });
        const assistantMessage = first.choices[0]?.message;
        const functionToolCalls = (assistantMessage?.tool_calls || []).filter(
          (call): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => call.type === "function",
        );

        await sseWriteText(
          reply.raw,
          `1. assistant_tool_calls：计划调用 ${functionToolCalls.length} 个工具\n`,
        );

        const toolResults = await Promise.all(
          functionToolCalls.map(async (call) => {
            const fnName = call.function.name;
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
            } catch {
              args = {};
            }

            if (fnName === "get_weather") {
              const result = await withRetry(
                "get_weather",
                () => getWeather(String(args.city || ""), args.date ? String(args.date) : undefined),
              );
              return { tool_call_id: call.id, name: fnName, result };
            }
            if (fnName === "get_current_time") {
              const result = await withRetry(
                "get_current_time",
                () => getCurrentTime(String(args.city || "")),
              );
              return { tool_call_id: call.id, name: fnName, result };
            }
            if (fnName === "get_clothing_advice") {
              const result = await withRetry(
                "get_clothing_advice",
                () => getClothingAdvice(Number(args.tempDiff || 0), String(args.weatherSummary || "")),
              );
              return { tool_call_id: call.id, name: fnName, result };
            }
            return { tool_call_id: call.id, name: fnName, result: { error: `unknown tool: ${fnName}` } };
          }),
        );

        for (const item of toolResults) {
          if (clientDisconnected) break;
          await sseWriteText(reply.raw, `2. tool_result ${item.name}\n\`\`\`json\n${JSON.stringify(item.result, null, 2)}\n\`\`\`\n`);
        }

        const secondMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          ...initialMessages,
          {
            role: "assistant",
            content: assistantMessage?.content || "",
            tool_calls: functionToolCalls,
          },
          ...toolResults.map((item) => ({
            role: "tool" as const,
            tool_call_id: item.tool_call_id,
            content: JSON.stringify(item.result),
          })),
        ];

        const finalStream = await client.chat.completions.create({
          model: resolvedModel,
          messages: secondMessages,
          temperature: 0.2,
          stream: true,
        });

        await sseWriteText(reply.raw, "3. assistant_final\n");
        for await (const part of finalStream) {
          if (clientDisconnected) break;
          const token = part.choices[0]?.delta?.content || "";
          if (!token) continue;
          sseWrite(reply.raw, JSON.stringify({ type: "token", content: token }));
        }

        if (!clientDisconnected) {
          sseWrite(reply.raw, JSON.stringify({ type: "meta", task, model: resolvedModel }));
          sseDone(reply.raw);
        }
        return;
      }

      const chunks = sentenceChunkDocs(RAG_CORPUS);
      const expandedQueries = expandRagQuery(input.trim());
      const hybridCandidates = expandedQueries.flatMap((q) =>
        chunks.map((chunk) => ({
          chunk,
          score: keywordScore(q, chunk.text),
        })),
      );
      const dedup = new Map<string, { chunk: RagChunk; score: number }>();
      for (const c of hybridCandidates) {
        const prev = dedup.get(c.chunk.id);
        if (!prev || c.score > prev.score) dedup.set(c.chunk.id, c);
      }
      const reranked = simpleRerank(input.trim(), Array.from(dedup.values()), topK);
      const finalChunks = reranked.map((x) => x.chunk);
      const answer = [
        `问题：${input.trim()}`,
        "基于检索证据总结：",
        ...finalChunks.map((c, idx) => `${idx + 1}. ${c.text}`),
        "结论：RAG 效果依赖检索召回与重排精度。",
      ].join("\n");

      await sseWriteText(reply.raw, "### RAG 检索过程\n\n");
      await sseWriteText(reply.raw, `1. 查询扩展\n${expandedQueries.map((q) => `- ${q}`).join("\n")}\n\n`);
      await sseWriteText(reply.raw, "2. 命中片段\n");
      for (const item of reranked) {
        if (clientDisconnected) break;
        await sseWriteText(reply.raw, `- [${item.chunk.docId}] (${Number(item.score.toFixed(3))}) ${item.chunk.text}\n`);
      }
      await sseWriteText(reply.raw, `\n3. 最终回答\n${answer}`);
      if (!clientDisconnected) {
        sseWrite(reply.raw, JSON.stringify({ type: "meta", task, expandedQueries, selectedCount: reranked.length }));
        sseDone(reply.raw);
      }
    } catch (error) {
      if (clientDisconnected) return;
      const message = error instanceof Error ? error.message : String(error);
      sseError(reply.raw, message);
    }
  });

  /**
   * 任务 2: LCEL Prompt -> LLM -> OutputParser
   * POST /api/learning/lcel-chain
   */
  app.post<{
    Body: {
      topic: string;
      tone?: "简洁" | "专业" | "口语化";
      model?: string;
      apiKey?: string;
      baseUrl?: string;
    };
  }>("/api/learning/lcel-chain", async (request) => {
    const { topic, tone = "简洁", model, apiKey, baseUrl } = request.body;
    if (!topic?.trim()) {
      throw new Error("topic is required");
    }

    const llm = createModel({ model, apiKey, baseUrl });
    const prompt = ChatPromptTemplate.fromTemplate(
      "请用{tone}风格，围绕“{topic}”输出 3 条要点，每条不超过 20 字。",
    );
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());
    const output = await chain.invoke({ topic, tone });

    return {
      input: { topic, tone },
      output,
    };
  });

  /**
   * 任务 3: LangGraph 简单多步骤工作流
   * POST /api/learning/langgraph-workflow
   */
  app.post<{
    Body: {
      input: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
    };
  }>("/api/learning/langgraph-workflow", async (request) => {
    const { input, model, apiKey, baseUrl } = request.body;
    if (!input?.trim()) {
      throw new Error("input is required");
    }

    const llm = createModel({ model, apiKey, baseUrl });

    const graph = new StateGraph(WorkflowState)
      .addNode("classify", async (state) => {
        const maybeMath = evaluateExpression(state.input);
        const intent = maybeMath !== null ? "math" : "general";
        return {
          intent,
          steps: [
            ...state.steps,
            { node: "classify", detail: `识别任务类型为 ${intent}` },
          ],
        };
      })
      .addNode("makePlan", async (state) => {
        const plan = state.intent === "math"
          ? "执行数学计算 -> 组织结果说明"
          : "生成简明回答 -> 组织结果说明";
        return {
          plan,
          steps: [
            ...state.steps,
            { node: "makePlan", detail: plan },
          ],
        };
      })
      .addNode("solveMath", async (state) => {
        const value = evaluateExpression(state.input);
        const draft = value === null ? "无法解析为数学表达式。" : `计算结果: ${value}`;
        return {
          draft,
          steps: [
            ...state.steps,
            { node: "solveMath", detail: draft },
          ],
        };
      })
      .addNode("generalAnswer", async (state) => {
        const prompt = ChatPromptTemplate.fromTemplate(
          "请对下面输入给出简明回答：\n{input}",
        );
        const output = await prompt.pipe(llm).pipe(new StringOutputParser()).invoke({
          input: state.input,
        });
        return {
          draft: output,
          steps: [
            ...state.steps,
            { node: "generalAnswer", detail: "已生成通用问题回答草稿" },
          ],
        };
      })
      .addNode("finalize", async (state) => {
        return {
          output: `Workflow 完成（${state.intent}）: ${state.draft}`,
          steps: [
            ...state.steps,
            { node: "finalize", detail: "输出最终结果" },
          ],
        };
      })
      .addEdge(START, "classify")
      .addEdge("classify", "makePlan")
      .addConditionalEdges("makePlan", (state) => {
        return state.intent === "math" ? "solveMath" : "generalAnswer";
      })
      .addEdge("solveMath", "finalize")
      .addEdge("generalAnswer", "finalize")
      .addEdge("finalize", END)
      .compile();

    const result = await graph.invoke({
      input,
      intent: "general",
      plan: "",
      draft: "",
      output: "",
      steps: [],
    });

    return {
      input,
      intent: result.intent,
      plan: result.plan,
      steps: result.steps,
      output: result.output,
    };
  });

  /**
   * 任务 4: Function Calling（天气并行工具案例）
   * POST /api/learning/function-call-weather
   */
  app.post<{
    Body: {
      query: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
    };
  }>("/api/learning/function-call-weather", async (request) => {
    const { query, model, apiKey, baseUrl } = request.body;
    if (!query?.trim()) {
      throw new Error("query is required");
    }
    if (query.length > 500) {
      throw new Error("query is too long");
    }

    const { client, resolvedBaseUrl } = createOpenAIClient({ apiKey, baseUrl });
    const resolvedModel = model || inferDefaultModel(resolvedBaseUrl);

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "查询某城市天气（教学 mock 数据）",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "城市名，如 北京" },
              date: { type: "string", description: "日期，如 today/2026-04-01" },
            },
            required: ["city"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_current_time",
          description: "查询某城市当前时间",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "城市名，如 上海" },
            },
            required: ["city"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_clothing_advice",
          description: "根据温差和天气概况生成穿衣建议",
          parameters: {
            type: "object",
            properties: {
              tempDiff: { type: "number", description: "两地温差（摄氏度）" },
              weatherSummary: { type: "string", description: "天气摘要文本" },
            },
            required: ["tempDiff", "weatherSummary"],
            additionalProperties: false,
          },
        },
      },
    ];

    const flow: Array<Record<string, unknown>> = [];
    const initialMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "你是天气助理。优先调用工具；如果涉及两个城市，尽量并行调用工具。拿到工具结果后再给最终结论。不要编造工具结果。",
      },
      { role: "user", content: query.trim() },
    ];

    const first = await client.chat.completions.create({
      model: resolvedModel,
      messages: initialMessages,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: true,
      temperature: 0.2,
    });

    const assistantMessage = first.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls || [];
    const functionToolCalls = toolCalls.filter(
      (call): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => call.type === "function",
    );
    flow.push({
      step: "assistant_tool_calls",
      content: assistantMessage?.content || "",
      toolCalls,
    });

    if (!functionToolCalls.length) {
      return {
        query,
        answer: assistantMessage?.content || "",
        flow,
      };
    }

    const toolResults = await Promise.all(
      functionToolCalls.map(async (call) => {
        const fnName = call.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          // ignore malformed args
        }

        try {
          if (fnName === "get_weather") {
            const result = await withRetry("get_weather", () => getWeather(String(args.city || ""), args.date ? String(args.date) : undefined));
            return { tool_call_id: call.id, name: fnName, result };
          }

          if (fnName === "get_current_time") {
            const result = await withRetry("get_current_time", () => getCurrentTime(String(args.city || "")));
            return { tool_call_id: call.id, name: fnName, result };
          }

          if (fnName === "get_clothing_advice") {
            const result = await withRetry(
              "get_clothing_advice",
              () => getClothingAdvice(Number(args.tempDiff || 0), String(args.weatherSummary || "")),
            );
            return { tool_call_id: call.id, name: fnName, result };
          }

          return {
            tool_call_id: call.id,
            name: fnName,
            result: { error: `unknown tool: ${fnName}` },
          };
        } catch (error) {
          return {
            tool_call_id: call.id,
            name: fnName,
            result: { error: error instanceof Error ? error.message : String(error) },
          };
        }
      }),
    );

    flow.push({
      step: "tool_results",
      parallel: toolResults.length > 1,
      results: toolResults,
    });

    const secondMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...initialMessages,
      {
        role: "assistant",
        content: assistantMessage?.content || "",
        tool_calls: functionToolCalls,
      },
      ...toolResults.map((item) => ({
        role: "tool" as const,
        tool_call_id: item.tool_call_id,
        content: JSON.stringify(item.result),
      })),
    ];

    const second = await client.chat.completions.create({
      model: resolvedModel,
      messages: secondMessages,
      temperature: 0.2,
    });
    const finalAnswer = second.choices[0]?.message?.content || "";
    flow.push({
      step: "assistant_final",
      content: finalAnswer,
    });

    return {
      query,
      model: resolvedModel,
      answer: finalAnswer,
      toolCalls: toolResults,
      flow,
    };
  });

  /**
   * 任务 5: RAG 检索管线可视化案例
   * POST /api/learning/rag-demo
   */
  app.post<{
    Body: {
      query: string;
      topK?: number;
    };
  }>("/api/learning/rag-demo", async (request) => {
    const { query, topK = 4 } = request.body;
    if (!query?.trim()) {
      throw new Error("query is required");
    }

    const chunks = sentenceChunkDocs(RAG_CORPUS);
    const expandedQueries = expandRagQuery(query);

    const hybridCandidates = expandedQueries.flatMap((q) =>
      chunks.map((chunk) => ({
        chunk,
        score: keywordScore(q, chunk.text),
      })),
    );

    const dedup = new Map<string, { chunk: RagChunk; score: number }>();
    for (const c of hybridCandidates) {
      const prev = dedup.get(c.chunk.id);
      if (!prev || c.score > prev.score) dedup.set(c.chunk.id, c);
    }

    const reranked = simpleRerank(query, Array.from(dedup.values()), topK);
    const finalChunks = reranked.map((x) => x.chunk);
    const answer = [
      `问题：${query}`,
      "基于检索证据总结：",
      ...finalChunks.map((c, idx) => `${idx + 1}. ${c.text}`),
      "结论：RAG 效果依赖检索召回与重排精度。",
    ].join("\n");

    const answerTokens = new Set(tokenize(answer));
    const contextTokens = new Set(tokenize(finalChunks.map((x) => x.text).join(" ")));
    const queryTokens = new Set(tokenize(query));
    const faithfulness = answerTokens.size
      ? Array.from(answerTokens).filter((t) => contextTokens.has(t)).length / answerTokens.size
      : 0;
    const relevancy = queryTokens.size
      ? Array.from(queryTokens).filter((t) => answerTokens.has(t)).length / queryTokens.size
      : 0;

    return {
      query,
      expandedQueries,
      selectedChunks: reranked.map((x) => ({
        id: x.chunk.id,
        docId: x.chunk.docId,
        text: x.chunk.text,
        score: Number(x.score.toFixed(3)),
      })),
      answer,
      metrics: {
        faithfulness: Number(faithfulness.toFixed(3)),
        relevancy: Number(relevancy.toFixed(3)),
        contextRecall: Number((finalChunks.length / Math.max(chunks.length, 1)).toFixed(3)),
      },
    };
  });
}
