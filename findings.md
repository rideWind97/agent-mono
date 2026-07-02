# MCP Week 6 Findings

## Repository Context

- `pnpm-workspace.yaml` 已包含 `examples/*`，新增 `examples/mcp-learning` 会自动成为 workspace 包。
- `examples/my-learning` 使用独立 `package.json`、`tsconfig.json` 和 `tsx` 脚本，MCP 示例沿用这个结构。
- Week 6 文档要求练习入口为 `examples/mcp-learning/`，重点 API 为 `McpServer`、`Client`、`StdioServerTransport`、`StdioClientTransport`。

## Implementation Notes

- `read_file` / `write_file` 需要限制在工作目录内，避免路径穿越。
- IDE 接入项更适合通过 README 给 Cursor / Claude Desktop 配置示例，而不是直接修改用户全局配置。
