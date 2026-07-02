# Week 6：MCP 协议

## 本周目标

理解 MCP 如何把「模型/Host」和「外部工具」解耦，并通过 stdio 方式实现一个最小可运行的 MCP Server + Client。

## 代码位置

- Server：`examples/mcp-learning/src/server.ts`
- Client：`examples/mcp-learning/src/client.ts`
- Cursor 项目级 MCP 配置：`.cursor/mcp.json`
- 工具工作目录：`examples/mcp-learning/workspace/`
- 运行命令：`pnpm --filter @agent-mono/mcp-learning client`

## Host → Client → Server

```txt
Host（Cursor / Claude Desktop / Web App / 示例 client.ts）
  ↓
MCP Client（负责连接、列工具、调用工具）
  ↓ stdio
MCP Server（暴露 read_file / write_file）
  ↓
workspace/（受限文件访问目录）
```

## 已实现工具

| Tool | 作用 | 安全边界 |
|------|------|----------|
| `read_file` | 读取文本文件 | 只能读 `examples/mcp-learning/workspace/` |
| `write_file` | 写入文本文件 | 只能写 `examples/mcp-learning/workspace/` |

## MCP vs 直接 Function Call

| 对比项 | MCP | 直接 Function Call |
|--------|-----|--------------------|
| 定位 | 标准化工具协议 | 单个模型 API 的工具调用能力 |
| 谁启动工具 | Host 启动 MCP Server | 应用代码自己执行函数 |
| 复用性 | 同一个 Server 可接入 Cursor、Claude Desktop、其他 Host | 通常绑定在当前应用代码里 |
| 适合场景 | IDE 工具、文件系统、数据库、内部平台能力、跨 Host 复用工具 | Web App 内部业务流程、一次性 Agent 编排、强业务定制工具 |
| 部署形态 | 独立进程，可用 stdio / HTTP 等传输 | 通常和应用服务部署在一起 |
| 权限边界 | Server 侧集中控制工具能力和访问范围 | 应用代码自己控制参数校验和执行权限 |

结论：如果工具希望被多个 AI Host 复用，优先考虑 MCP；如果工具只服务当前后端 Agent 流程，直接 Function Call 更轻量。

## 验收结果

- `client.listTools()` 能列出 `read_file` / `write_file`
- `client.callTool()` 能写入并读取 `workspace/week-6-note.md`
- 文件访问限制在示例包的 `workspace/` 目录内
