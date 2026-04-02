import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const WEATHER_DB: Record<string, { condition: string; tempC: number }> = {
  北京: { condition: "晴", tempC: 21 },
  上海: { condition: "多云", tempC: 24 },
  杭州: { condition: "小雨", tempC: 19 },
};

const server = new McpServer({
  name: "mcp-learning-server",
  version: "0.1.0",
});

// 1) Resource: read-only context.
server.registerResource(
  "intro-guide",
  "guide://intro",
  {
    title: "MCP Intro Guide",
    description: "A tiny MCP guide for learning resources/tools/prompts.",
    mimeType: "text/plain",
  },
  async () => ({
    contents: [
      {
        uri: "guide://intro",
        mimeType: "text/plain",
        text: [
          "MCP primitives:",
          "- resources: read context",
          "- tools: execute actions",
          "- prompts: reusable templates",
        ].join("\n"),
      },
    ],
  }),
);

// 2) Tool: executable action with validated schema.
server.registerTool(
  "get_weather",
  {
    title: "Get Weather",
    description: "Query weather by city from mock DB.",
    inputSchema: {
      city: z.string().min(2).describe("城市名，例如 北京"),
    },
  },
  async ({ city }) => {
    const result = WEATHER_DB[city];
    if (!result) {
      return {
        content: [{ type: "text", text: `未找到城市: ${city}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `${city}天气：${result.condition}，${result.tempC}°C`,
        },
      ],
      structuredContent: {
        city,
        ...result,
      },
    };
  },
);

// 3) Prompt: reusable prompt template.
server.registerPrompt(
  "weather_compare_prompt",
  {
    title: "Weather Compare Prompt",
    description: "Template to compare two cities weather.",
    argsSchema: {
      cityA: z.string(),
      cityB: z.string(),
    },
  },
  ({ cityA, cityB }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `请对比${cityA}和${cityB}的天气、温差，并给出穿衣建议。`,
        },
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("[mcp-server] fatal:", error);
  process.exit(1);
});
