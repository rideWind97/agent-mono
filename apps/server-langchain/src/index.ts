import cors from "@fastify/cors";
import Fastify from "fastify";

import { config } from "./config.js";
import { agentRoutes } from "./routes/agent.js";
import { chatRoutes } from "./routes/chat.js";
import { learningRoutes } from "./routes/learning.js";

const app = Fastify({ logger: true });

// CORS
await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// Routes
await app.register(agentRoutes);
await app.register(chatRoutes);
await app.register(learningRoutes);

// Health check
app.get("/api/health", async () => {
  return { status: "ok", timestamp: Date.now() };
});

// Start server
try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`🚀 Server running at http://localhost:${config.port}`);
  console.log(`📋 Available tools: GET http://localhost:${config.port}/api/agent/tools`);
  console.log(`💬 Agent chat: POST http://localhost:${config.port}/api/agent/chat`);
  console.log(`💬 Simple chat: POST http://localhost:${config.port}/api/chat`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
