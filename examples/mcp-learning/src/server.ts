import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../workspace");

function resolveWorkspacePath(relativePath: string) {
  const targetPath = path.resolve(workspaceRoot, relativePath);
  const relativeFromWorkspace = path.relative(workspaceRoot, targetPath);

  if (relativeFromWorkspace.startsWith("..") || path.isAbsolute(relativeFromWorkspace)) {
    throw new Error(`只能访问 MCP 示例工作目录：${relativePath}`);
  }

  return targetPath;
}

const server = new McpServer({
  name: "agent-mono-mcp-learning",
  version: "0.0.0",
});

server.tool(
  "read_file",
  "读取 examples/mcp-learning/workspace 目录内的文本文件。",
  {
    path: z.string().describe("相对 workspace 的文件路径，例如 notes.md"),
  },
  async ({ path: filePath }) => {
    const targetPath = resolveWorkspacePath(filePath);
    const text = await readFile(targetPath, "utf8");

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  },
);

server.tool(
  "write_file",
  "写入 examples/mcp-learning/workspace 目录内的文本文件。",
  {
    path: z.string().describe("相对 workspace 的文件路径，例如 notes.md"),
    content: z.string().describe("要写入的文本内容"),
  },
  async ({ path: filePath, content }) => {
    const targetPath = resolveWorkspacePath(filePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");

    return {
      content: [
        {
          type: "text",
          text: `已写入 ${filePath}`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
