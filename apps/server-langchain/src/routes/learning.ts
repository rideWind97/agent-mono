import type { ServerResponse } from "node:http";

import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type { FastifyInstance } from "fastify";

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
}
