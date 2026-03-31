import express, { type Express } from "express";
import cors from "cors";

import { chatRouter } from "./routes/chat.js";
import { geminiRouter } from "./routes/gemini.js";
import { agentRouter } from "./routes/agent.js";
import { agentGeminiRouter } from "./routes/agent-gemini.js";

const app: Express = express();
const PORT = Number(process.env.PORT) || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 健康检查
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API 路由
app.use("/api/chat", chatRouter);
app.use("/api/gemini", geminiRouter);
app.use("/api/agent/gemini", agentGeminiRouter);
app.use("/api/agent", agentRouter);

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
