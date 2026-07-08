# Agent Week 9 Task Plan

## Goal

完成 `AGENT_LEARNING_PLAN.md` Week 9 的 Agent 练习项：在 `examples/agent-practice/` 实现可运行的 ReAct Agent 和 Supervisor 多 Agent 示例，并补充 Agent vs Workflow 选型说明。

## Phases

- [x] Phase 1: 阅读 Week 9 要求、现有 examples 结构和 Agent 架构文档
- [x] Phase 2: 创建 `examples/agent-practice` 包和基础脚本
- [x] Phase 3: 实现 ReAct 多步工具调用与 Supervisor 多 Agent 调度
- [x] Phase 4: 补充 README、学习笔记和计划文档勾选
- [x] Phase 5: 运行 demo / typecheck 验证

## Decisions

- Agent 示例作为独立 workspace package 放在 `examples/agent-practice`。
- 为了稳定教学，先用本地规则模拟“模型决策”，展示 ReAct 的 Thought / Action / Observation / Final 轨迹。
- Supervisor 负责拆分任务并路由给 researcher / calculator / writer 三个专业 Agent。

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
