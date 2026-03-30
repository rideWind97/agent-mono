import { Router, type Router as RouterType } from "express";
import { GoogleGenAI } from "@google/genai";

const router: RouterType = Router();

interface GeminiRequestBody {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 将 OpenAI 格式的 messages 转换为 Gemini 格式的 contents
 * Gemini 使用 "user" 和 "model" 角色，不支持 "system" 角色（需要单独处理）
 */
function convertToGeminiContents(
  messages: GeminiRequestBody["messages"]
): { systemInstruction: string | undefined; contents: Array<{ role: string; parts: Array<{ text: string }> }> } {
  let systemInstruction: string | undefined;
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      // Gemini 使用 systemInstruction 处理 system prompt
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
 * POST /api/gemini
 * Gemini 流式对话接口 — 使用 @google/genai SDK，以 SSE 流式返回
 */
router.post("/", async (req, res) => {
  const {
    messages,
    model = "gemini-3-flash-preview",
    apiKey,
    temperature = 0.7,
    maxTokens = 2048,
  } = req.body as GeminiRequestBody;

  // 优先使用前端传来的 apiKey，否则读取环境变量
  const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!resolvedApiKey) {
    res.status(400).json({
      error: "缺少 Gemini API Key，请在设置中配置或设置环境变量 GEMINI_API_KEY",
    });
    return;
  }

  if (!messages || messages.length === 0) {
    res.status(400).json({ error: "消息列表不能为空" });
    return;
  }

  // 创建 Gemini 客户端
  const ai = new GoogleGenAI({ apiKey: resolvedApiKey });

  // 转换消息格式
  const { systemInstruction, contents } = convertToGeminiContents(messages);

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    // 使用 Gemini 流式生成
    const response = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        // 转换为与 OpenAI 兼容的 SSE 格式，前端无需修改解析逻辑
        const data = JSON.stringify({
          choices: [
            {
              delta: {
                content: text,
              },
            },
          ],
        });
        res.write(`data: ${data}\n\n`);
      }
    }

    // 发送结束标记
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Gemini API error:", error);

    // 如果还没开始写流，返回 JSON 错误
    if (!res.headersSent) {
      const message =
        error instanceof Error ? error.message : "Gemini 服务调用失败";
      res.status(500).json({ error: message });
      return;
    }

    // 如果已经在流中，发送错误事件
    const errorMsg =
      error instanceof Error ? error.message : "Gemini 服务调用失败";
    res.write(
      `data: ${JSON.stringify({ error: errorMsg })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

/**
 * GET /api/gemini/models
 * 获取 Gemini 推荐模型列表
 */
router.get("/models", (_req, res) => {
  // Gemini 模型列表（常用模型）
  res.json({
    models: [
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)" },
      { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite (Preview)" },
      { id: "gemini-3.1-flash-image-preview", name: "Gemini 3.1 Flash Image (Preview)" },
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)" },
      { id: "gemini-3-pro-image-preview", name: "Gemini 3 Pro Image (Preview)" },
    ],
  });
});

export { router as geminiRouter };
