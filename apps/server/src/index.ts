import express, { type Express } from "express";
import cors from "cors";

import { chatRouter } from "./routes/chat.js";
import { geminiRouter } from "./routes/gemini.js";

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

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
