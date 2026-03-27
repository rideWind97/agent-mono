import { createServer } from "node:http";

import { APP_NAME, HTTP_STATUS } from "@agent-mono/shared";
import type { ApiResponse } from "@agent-mono/shared";

const PORT = process.env["PORT"] ?? 4000;

const server = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/api/health") {
    const response: ApiResponse<{ status: string; name: string }> = {
      success: true,
      data: { status: "healthy", name: APP_NAME },
      timestamp: Date.now(),
    };
    res.writeHead(HTTP_STATUS.OK);
    res.end(JSON.stringify(response));
    return;
  }

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    message: "Not Found",
    timestamp: Date.now(),
  };
  res.writeHead(HTTP_STATUS.NOT_FOUND);
  res.end(JSON.stringify(response));
});

server.listen(PORT, () => {
  console.log(`🚀 ${APP_NAME} API server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});
