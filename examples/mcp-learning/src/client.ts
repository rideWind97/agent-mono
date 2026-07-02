import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const client = new Client({
  name: "agent-mono-mcp-learning-client",
  version: "0.0.0",
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");

const transport = new StdioClientTransport({
  command: "pnpm",
  args: ["--dir", repoRoot, "--filter", "@agent-mono/mcp-learning", "run", "server"],
});

function printTitle(title: string) {
  console.log(`\n=== ${title} ===`);
}

await client.connect(transport);

try {
  printTitle("List Tools");
  const tools = await client.listTools();
  console.log(
    tools.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    })),
  );

  printTitle("Call write_file");
  const writeResult = await client.callTool({
    name: "write_file",
    arguments: {
      path: "week-6-note.md",
      content: [
        "# Week 6 MCP Demo",
        "",
        "这行内容由 MCP Client 通过 write_file 工具写入。",
      ].join("\n"),
    },
  });
  console.log(writeResult.content);

  printTitle("Call read_file");
  const readResult = await client.callTool({
    name: "read_file",
    arguments: {
      path: "week-6-note.md",
    },
  });
  console.log(readResult.content);
} finally {
  await client.close();
}
