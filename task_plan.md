# Workflow Week 10 Task Plan

## Goal

完成 `AGENT_LEARNING_PLAN.md` Week 10 的 Workflow 练习项：在 `examples/workflow-practice/` 实现内容创作 DAG、条件分支、HITL 中断、resume 继续和 checkpoint 持久化。

## Phases

- [x] Phase 1: 阅读 Week 10 要求、现有 examples 结构和已有 LangGraph 示例
- [x] Phase 2: 创建 `examples/workflow-practice` 包和基础脚本
- [x] Phase 3: 实现内容创作 DAG、HITL 中断和 checkpoint resume
- [x] Phase 4: 补充 README、学习笔记和计划文档勾选
- [x] Phase 5: 运行 demo / typecheck 验证

## Decisions

- Workflow 示例作为独立 workspace package 放在 `examples/workflow-practice`。
- 为了稳定教学，使用本地 TypeScript 实现确定性 DAG 和 checkpoint，不依赖真实 LLM 调用。
- HITL 使用 `humanApproval` 节点中断；resume 从 `.checkpoints/<threadId>.json` 读取状态继续执行。

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `case "end"` 被 TypeScript 判断为不可达 | 首次运行 workflow typecheck | `while` 条件已经排除 `end`，删除 switch 中的 `case "end"` |
