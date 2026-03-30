import { Router, type Router as RouterType } from "express";
import OpenAI from "openai";

const router: RouterType = Router();

interface ChatRequestBody {
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

/**
 * POST /api/chat
 * 流式对话接口 — 接收前端消息，调用 OpenAI 兼容 API，以 SSE 流式返回
 */
router.post("/", async (req, res) => {
  const {
    messages,
    model = "gpt-4o-mini",
    apiKey,
    baseUrl = "https://api.openai.com/v1",
    temperature = 0.7,
    maxTokens = 2048,
  } = req.body as ChatRequestBody;

  // 优先使用前端传来的 apiKey，否则读取环境变量
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;

  if (!resolvedApiKey) {
    res.status(400).json({
      error: "缺少 API Key，请在设置中配置或设置环境变量 OPENAI_API_KEY",
    });
    return;
  }

  if (!messages || messages.length === 0) {
    res.status(400).json({ error: "消息列表不能为空" });
    return;
  }

  // 创建 OpenAI 客户端（每次请求可能使用不同的 baseUrl / apiKey）
  const client = new OpenAI({
    apiKey: resolvedApiKey,
    baseURL: baseUrl,
  });

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      temperature,
      max_tokens: maxTokens,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // 发送 SSE 格式数据
      const data = JSON.stringify({
        choices: [
          {
            delta: {
              content: delta.content || "",
              role: delta.role,
            },
          },
        ],
      });

      res.write(`data: ${data}\n\n`);
    }

    // 发送结束标记
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Chat API error:", error);

    // 如果还没开始写流，返回 JSON 错误
    if (!res.headersSent) {
      const message =
        error instanceof Error ? error.message : "AI 服务调用失败";
      res.status(500).json({ error: message });
      return;
    }

    // 如果已经在流中，发送错误事件
    const errorMsg =
      error instanceof Error ? error.message : "AI 服务调用失败";
    res.write(
      `data: ${JSON.stringify({ error: errorMsg })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

/**
 * GET /api/chat/models
 * 获取可用模型列表（可选功能）
 */
router.get("/models", async (req, res) => {
  const apiKey =
    (req.query.apiKey as string) || process.env.OPENAI_API_KEY;
  const baseUrl =
    (req.query.baseUrl as string) || "https://api.openai.com/v1";

  if (!apiKey) {
    res.status(400).json({ error: "缺少 API Key" });
    return;
  }

  try {
    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    const models = await client.models.list();
    res.json({
      models: models.data.map((m) => ({
        id: m.id,
        created: m.created,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取模型列表失败";
    res.status(500).json({ error: message });
  }
});

export { router as chatRouter };
