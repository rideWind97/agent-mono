import cors from "@fastify/cors";
import Fastify from "fastify";

import { assertServerConfig, serverConfig } from "./config.js";
import { chatRoutes } from "./routes/chat.js";
import { learningRoutes } from "./routes/learning.js";

assertServerConfig();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(chatRoutes);
await app.register(learningRoutes);

app.get("/api/health", async () => ({
  ok: true,
  service: "agent-mono-server",
  timestamp: Date.now(),
}));

try {
  await app.listen({ port: serverConfig.port, host: serverConfig.host });
  console.log(`[server] http://localhost:${serverConfig.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
