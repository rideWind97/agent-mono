import { Router, type Router as RouterType } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  Content,
  FunctionCall,
  FunctionDeclaration,
  Part,
} from "@google/genai";

const router: RouterType = Router();

/* ------------------------------------------------------------------ */
/*  内置工具定义 — Gemini FunctionDeclaration 格式                       */
/* ------------------------------------------------------------------ */

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_weather",
    description: "获取指定城市的当前天气信息",
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: {
          type: Type.STRING,
          description: "城市名称，例如：北京、上海",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "calculator",
    description: "计算数学表达式，支持加减乘除和括号",
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: {
          type: Type.STRING,
          description: "数学表达式，例如：(1 + 2) * 3",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "get_current_time",
    description: "获取当前日期和时间",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

/* ------------------------------------------------------------------ */
/*  工具执行器 — 与 agent.ts 中的逻辑保持一致                             */
/* ------------------------------------------------------------------ */

const toolExecutors: Record<
  string,
  (args: Record<string, unknown>) => Promise<string>
> = {
  get_weather: async (args) => {
    const city = (args.city as string) ?? "";
    const mockWeather: Record<string, string> = {
      北京: "晴，气温 28°C，湿度 45%",
      上海: "多云，气温 26°C，湿度 65%",
      广州: "雷阵雨，气温 32°C，湿度 80%",
      深圳: "阴，气温 30°C，湿度 70%",
      杭州: "晴转多云，气温 27°C，湿度 55%",
    };
    return mockWeather[city] ?? `${city}：晴，气温 25°C，湿度 50%（模拟数据）`;
  },

  calculator: async (args) => {
    const expression = (args.expression as string) ?? "";
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      if (!sanitized) return "无效的数学表达式";
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${sanitized})`)();
      return `${expression} = ${result}`;
    } catch {
      return `无法计算表达式: ${expression}`;
    }
  },

  get_current_time: async () => {
    const now = new Date();
    return `当前时间: ${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`;
  },
};

/* ------------------------------------------------------------------ */
/*  请求体类型                                                         */
/* ------------------------------------------------------------------ */

interface GeminiAgentRequestBody {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

/* ------------------------------------------------------------------ */
/*  辅助函数                                                           */
/* ------------------------------------------------------------------ */

/**
 * 将 OpenAI 格式的 messages 转换为 Gemini 格式的 contents
 */
function convertToGeminiContents(messages: GeminiAgentRequestBody["messages"]): {
  systemInstruction: string | undefined;
  contents: Content[];
} {
  let systemInstruction: string | undefined;
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = msg.content;
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  return { systemInstruction, contents };
}

/**
 * 执行 Gemini 返回的 function calls，返回 function response parts
 */
async function executeFunctionCalls(
  functionCalls: FunctionCall[],
  sseWrite: (data: string) => void,
): Promise<Part[]> {
  const responseParts: Part[] = [];

  for (const fc of functionCalls) {
    const toolName = fc.name ?? "unknown";
    const toolArgs = (fc.args as Record<string, unknown>) ?? {};

    // 发送 tool_start SSE 事件
    sseWrite(
      JSON.stringify({
        type: "tool_start",
        tool: toolName,
        input: toolArgs,
      }),
    );

    // 执行工具
    const executor = toolExecutors[toolName];
    let output: string;
    if (executor) {
      try {
        output = await executor(toolArgs);
      } catch (err) {
        output = `工具执行失败: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      output = `未知工具: ${toolName}`;
    }

    // 发送 tool_end SSE 事件
    sseWrite(
      JSON.stringify({
        type: "tool_end",
        tool: toolName,
        output,
      }),
    );

    responseParts.push({
      functionResponse: {
        name: toolName,
        id: fc.id,
        response: { output },
      },
    });
  }

  return responseParts;
}

/* ------------------------------------------------------------------ */
/*  POST /api/agent/gemini — Gemini Agent 流式对话（带工具调用）           */
/* ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  const {
    messages,
    model = "gemini-3-flash-preview",
    apiKey,
    temperature = 0.7,
    maxTokens = 2048,
  } = req.body as GeminiAgentRequestBody;

  const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!resolvedApiKey) {
    res.status(400).json({
      error: "缺少 Gemini API Key，请在设置中配置",
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

  const sseWrite = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  try {
    const ai = new GoogleGenAI({ apiKey: resolvedApiKey });
    const { systemInstruction, contents } = convertToGeminiContents(messages);

    // 构建对话历史（可变，用于多轮工具调用）
    const conversationContents: Content[] = [...contents];

    // Agent 循环：最多 10 轮工具调用，防止无限循环
    const MAX_TOOL_ROUNDS = 10;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      // 调用 Gemini（非流式，以便检测 function calls）
      const response = await ai.models.generateContent({
        model,
        contents: conversationContents,
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens: maxTokens,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        sseWrite(JSON.stringify({ error: "Gemini 未返回有效响应" }));
        break;
      }

      const parts = candidate.content?.parts ?? [];
      const functionCalls = response.functionCalls;

      // 如果有 function calls，执行工具并继续循环
      if (functionCalls && functionCalls.length > 0) {
        // 将模型的 function call 响应加入对话历史
        conversationContents.push({
          role: "model",
          parts,
        });

        // 执行所有 function calls
        const functionResponseParts = await executeFunctionCalls(
          functionCalls,
          sseWrite,
        );

        // 将 function responses 加入对话历史
        conversationContents.push({
          role: "user",
          parts: functionResponseParts,
        });

        // 继续下一轮
        continue;
      }

      // 没有 function calls — 这是最终的文本回复
      // 使用流式输出最终回复
      const streamResponse = await ai.models.generateContentStream({
        model,
        contents: conversationContents,
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens: maxTokens,
          // 最终回复不需要工具
        },
      });

      for await (const chunk of streamResponse) {
        const text = chunk.text;
        if (text) {
          sseWrite(
            JSON.stringify({
              type: "token",
              choices: [{ delta: { content: text } }],
            }),
          );
        }
      }

      break; // 文本回复完成，退出循环
    }

    sseWrite("[DONE]");
    res.end();
  } catch (error) {
    console.error("Gemini Agent error:", error);

    if (!res.headersSent) {
      const message =
        error instanceof Error ? error.message : "Gemini Agent 调用失败";
      res.status(500).json({ error: message });
      return;
    }

    const errorMsg =
      error instanceof Error ? error.message : "Gemini Agent 调用失败";
    sseWrite(JSON.stringify({ error: errorMsg }));
    sseWrite("[DONE]");
    res.end();
  }
});

export { router as agentGeminiRouter };
