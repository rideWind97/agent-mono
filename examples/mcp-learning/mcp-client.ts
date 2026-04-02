import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "pnpm",
    args: ["server"],
    cwd: process.cwd(),
  });

  const client = new Client({
    name: "mcp-learning-client",
    version: "0.1.0",
  });

  await client.connect(transport);

  // 1) List tools
  const tools = await client.listTools();
  console.log("[tools]", tools);

  // 2) Call tool
  const weather = await client.callTool({
    name: "get_weather",
    arguments: { city: "北京" },
  });
  console.log("[tool:get_weather]", weather);

  // 3) Read resource
  const guide = await client.readResource({
    uri: "guide://intro",
  });
  console.log("[resource:guide://intro]", guide);

  // 4) Get prompt
  const prompt = await client.getPrompt({
    name: "weather_compare_prompt",
    arguments: { cityA: "北京", cityB: "上海" },
  });
  console.log("[prompt:weather_compare_prompt]", prompt);

  await client.close();
}

main().catch((error) => {
  console.error("[mcp-client] fatal:", error);
  process.exit(1);
});
