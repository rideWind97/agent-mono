# MCP Week 6 Task Plan

## Goal

完成 `AGENT_LEARNING_PLAN.md` Week 6 的 MCP 练习项：实现 stdio MCP Server + Client，提供受限文件工具，补充 IDE 接入说明和 MCP 对比笔记。

## Phases

- [x] Phase 1: 阅读当前 monorepo 示例结构和 Week 6 要求
- [x] Phase 2: 创建 `examples/mcp-learning` 包和 MCP server/client
- [x] Phase 3: 补充 README、学习笔记和计划文档勾选
- [x] Phase 4: 安装依赖并运行 typecheck / demo 验证

## Decisions

- MCP 示例作为独立 workspace package 放在 `examples/mcp-learning`。
- 文件工具仅允许访问该示例包内的 `workspace/` 目录。

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `pnpm ... server` 被解析为 pnpm 内置命令并报 `Unknown option: 'recursive'` | 运行 MCP client demo | 改为显式 `pnpm --dir <repo> --filter @agent-mono/mcp-learning run server` |
