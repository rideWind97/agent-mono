# MCP Week 6 Progress

## 2026-07-01

- 已确认 Week 6 任务范围：stdio MCP server/client、受限文件工具、IDE 接入说明、MCP vs Function Call 对比笔记。
- 已确认新增示例包应放在 `examples/mcp-learning`。
- 已创建 `@agent-mono/mcp-learning`，包含 `src/server.ts` 和 `src/client.ts`。
- 已通过 `pnpm --filter @agent-mono/mcp-learning client` 验证：能 list tools、写入并读取 `workspace/week-6-note.md`。
- 已添加 `.cursor/mcp.json`，作为项目级 Cursor MCP server 配置。
- 已通过 `pnpm typecheck` 验证整个 monorepo 类型检查。

## 2026-07-02

- 已确认 Week 7-8 任务范围：RAG 链路、知识库、chunk 策略对比、Hybrid Search、10 条 QA 评估。
- 已创建 `@agent-mono/rag-learning`，包含 5 篇 Markdown 知识库和 10 条 QA 测试集。
- 已实现本地 Hashing Embedding、内存向量库、Hybrid Search、问答、chunk 对比和 eval 脚本。
- 当前 `pnpm --filter @agent-mono/rag-learning eval` 结果：检索命中率 10/10，答案关键词命中率 8/10。
