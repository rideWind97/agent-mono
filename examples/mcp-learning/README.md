# MCP Learning

Week 6 MCP 协议练习：用 stdio 方式实现一个 MCP Server，并用本地 Client 模拟 Host 调用工具。

## 目录

- `src/server.ts`：MCP Server，暴露 `read_file` / `write_file` 工具
- `src/client.ts`：MCP Client，连接 server、列出工具并调用工具
- `workspace/`：工具允许访问的工作目录

## 本地运行

```bash
pnpm --filter @agent-mono/mcp-learning client
```

执行后会看到三段输出：

1. `listTools()` 列出 `read_file` / `write_file`
2. `callTool({ name: "write_file" })` 写入 `workspace/week-6-note.md`
3. `callTool({ name: "read_file" })` 读回刚才写入的内容

## 工具边界

`read_file` 和 `write_file` 只允许访问 `examples/mcp-learning/workspace/` 内的路径。

例如允许：

```txt
week-6-note.md
notes/today.md
```

例如拒绝：

```txt
../package.json
/tmp/test.txt
```

## Cursor 接入示例

项目已提供 `.cursor/mcp.json`，Cursor 可使用这个项目级 MCP 配置启动 server。配置内容如下：

```json
{
  "mcpServers": {
    "agent-mono-mcp-learning": {
      "command": "pnpm",
      "args": ["--dir", "/Users/chengfeng/workspace/agent-mono", "--filter", "@agent-mono/mcp-learning", "run", "server"]
    }
  }
}
```

配置后，Host 会启动这个 stdio server，并通过 MCP Client 调用 `read_file` / `write_file`。

## Claude Desktop 接入示例

Claude Desktop 的 MCP 配置结构类似：

```json
{
  "mcpServers": {
    "agent-mono-mcp-learning": {
      "command": "pnpm",
      "args": ["--dir", "/Users/chengfeng/workspace/agent-mono", "--filter", "@agent-mono/mcp-learning", "run", "server"]
    }
  }
}
```

## 三层关系

```txt
Host（Cursor / Claude Desktop / 本地 client.ts）
  ↓ 内置或示例 MCP Client
Client（负责协议通信、listTools、callTool）
  ↓ stdio
Server（src/server.ts，暴露 read_file / write_file）
  ↓
workspace/（受限文件访问目录）
```
