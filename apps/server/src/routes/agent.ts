import { Router, type Router as RouterType } from "express";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod/v3";

const router: RouterType = Router();

/* ------------------------------------------------------------------ */
/*  内置工具定义                                                       */
/* ------------------------------------------------------------------ */

/** 天气查询工具（示例） */
const weatherTool = tool(
  async ({ city }) => {
    // 模拟天气数据 —— 实际项目中可对接真实天气 API
    const mockWeather: Record<string, string> = {
      北京: "晴，气温 28°C，湿度 45%",
      上海: "多云，气温 26°C，湿度 65%",
      广州: "雷阵雨，气温 32°C，湿度 80%",
      深圳: "阴，气温 30°C，湿度 70%",
      杭州: "晴转多云，气温 27°C，湿度 55%",
    };
    return mockWeather[city] ?? `${city}：晴，气温 25°C，湿度 50%（模拟数据）`;
  },
  {
    name: "get_weather",
    description: "获取指定城市的当前天气信息",
    schema: z.object({
      city: z.string().describe("城市名称，例如：北京、上海"),
    }),
  },
);

/** 计算器工具 */
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // 安全的数学表达式求值（仅允许数字和基本运算符）
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      if (!sanitized) return "无效的数学表达式";
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${sanitized})`)();
      return `${expression} = ${result}`;
    } catch {
      return `无法计算表达式: ${expression}`;
    }
  },
  {
    name: "calculator",
    description: "计算数学表达式，支持加减乘除和括号",
    schema: z.object({
      expression: z.string().describe("数学表达式，例如：(1 + 2) * 3"),
    }),
  },
);

/** 当前时间工具 */
const currentTimeTool = tool(
  async () => {
    const now = new Date();
    return `当前时间: ${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`;
  },
  {
    name: "get_current_time",
    description: "获取当前日期和时间",
    schema: z.object({}),
  },
);

const TOOLS = [weatherTool, calculatorTool, currentTimeTool];

/* ------------------------------------------------------------------ */
/*  请求体类型                                                         */
/* ------------------------------------------------------------------ */

interface AgentRequestBody {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/* ------------------------------------------------------------------ */
/*  POST /api/agent — 流式 Agent 对话                                  */
/* ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  const {
    messages,
    model = "gpt-4o-mini",
    apiKey,
    baseUrl = "https://api.openai.com/v1",
    temperature = 0.7,
    maxTokens = 2048,
  } = req.body as AgentRequestBody;

  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;

  if (!resolvedApiKey) {
    res.status(400).json({
      error: "缺少 API Key，请在设置中配置",
    });
    return;
  }

  if (!messages || messages.length === 0) {
    res.status(400).json({ error: "消息列表不能为空" });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const llm = new ChatOpenAI({
      model,
      apiKey: resolvedApiKey,
      configuration: { baseURL: baseUrl },
      temperature,
      maxTokens,
      streaming: true,
    });

    // 创建 ReAct Agent
    const agent = createReactAgent({
      llm,
      tools: TOOLS,
    });

    // 转换消息格式
    const langchainMessages = messages.map((m) => {
      if (m.role === "system") return new SystemMessage(m.content);
      return new HumanMessage(m.content);
    });

    // 使用 streamEvents 获取流式输出
    const eventStream = agent.streamEvents(
      { messages: langchainMessages },
      { version: "v2" },
    );

    for await (const event of eventStream) {
      // 工具调用事件
      if (event.event === "on_tool_start") {
        const toolData = JSON.stringify({
          type: "tool_start",
          tool: event.name,
          input: event.data?.input,
        });
        res.write(`data: ${toolData}\n\n`);
      }

      // 工具结果事件
      if (event.event === "on_tool_end") {
        const toolData = JSON.stringify({
          type: "tool_end",
          tool: event.name,
          output: event.data?.output,
        });
        res.write(`data: ${toolData}\n\n`);
      }

      // LLM 流式 token
      if (
        event.event === "on_chat_model_stream" &&
        event.tags?.includes("agent:llm")
      ) {
        const content = event.data?.chunk?.content;
        if (content) {
          const data = JSON.stringify({
            type: "token",
            choices: [
              {
                delta: {
                  content: typeof content === "string" ? content : "",
                },
              },
            ],
          });
          res.write(`data: ${data}\n\n`);
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Agent error:", error);

    if (!res.headersSent) {
      const message =
        error instanceof Error ? error.message : "Agent 调用失败";
      res.status(500).json({ error: message });
      return;
    }

    const errorMsg =
      error instanceof Error ? error.message : "Agent 调用失败";
    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/agent/tools — 获取可用工具列表                             */
/* ------------------------------------------------------------------ */

router.get("/tools", (_req, res) => {
  res.json({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
    })),
  });
});

export { router as agentRouter };
