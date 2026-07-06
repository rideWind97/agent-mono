# RAG Week 7-8 Task Plan

## Goal

完成 `AGENT_LEARNING_PLAN.md` Week 7-8 的 RAG 练习项：创建 `examples/rag-learning`，实现本地知识库加载、分块、Embedding、向量库检索、Hybrid Search、问答、chunk 策略对比和 10 条 QA 评估。

## Phases

- [x] Phase 1: 阅读当前 monorepo 示例结构和 Week 7-8 要求
- [x] Phase 2: 创建 `examples/rag-learning` 包、知识库文档和 QA 测试集
- [x] Phase 3: 实现 RAG 核心链路与带注释代码
- [x] Phase 4: 补充 README、学习笔记和计划文档勾选
- [x] Phase 5: 运行 demo / eval / typecheck 验证

## Decisions

- RAG 示例作为独立 workspace package 放在 `examples/rag-learning`。
- 为了从零学习和稳定运行，使用本地 Hashing Embedding + 内存向量库，不依赖真实 Embedding API。
- Hybrid Search 使用向量相似度 + 关键词重叠分数，便于观察检索质量变化。

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| 新增 workspace 后 `@agent-mono/typescript-config/node-app.json` 找不到 | 首次运行 RAG typecheck | 需要运行 `pnpm install` 让新 package 链接 workspace 依赖 |
| 中文 query token 过长导致向量库相关问题未命中 | 首次运行 RAG eval | 优化 tokenizer，为中文连续文本生成 2-4 字 n-gram |
