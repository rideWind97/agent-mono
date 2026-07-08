# Workflow Practice

Week 10 Workflow 练习：实现一个内容创作工作流，包含 DAG、条件分支、循环修订、Human-in-the-loop 和 checkpoint 持久化。

这个示例使用本地 TypeScript 实现，目的是先把 Workflow 的状态流转看清楚。概念上对应 LangGraph 的：

- `StateGraph`：固定节点和边组成的状态图
- `interrupt()`：在人工审批节点中断
- `MemorySaver / checkpoint`：保存状态，支持 resume

## 运行

完整演示：

```bash
pnpm --filter @agent-mono/workflow-practice demo
```

手动分两步运行：

```bash
pnpm --filter @agent-mono/workflow-practice start "Workflow 和 Agent 的区别"
pnpm --filter @agent-mono/workflow-practice resume <threadId> approve "内容可以发布"
```

根命令：

```bash
pnpm week10:workflow:demo
pnpm week10:workflow:start
pnpm week10:workflow:resume
```

## 流程图

```txt
brief
  ↓
research
  ↓
draft
  ↓
qualityReview
  ├─ score < 85 -> revise -> qualityReview
  └─ score >= 85 -> humanApproval
                         ├─ reject -> revise -> qualityReview
                         └─ approve -> publish -> end
```

## HITL 和 Resume

`humanApproval` 是人工审批节点。执行到这里时，工作流会：

1. 把完整 state 写入 `.checkpoints/<threadId>.json`
2. 把状态标记为 `interrupted`
3. 等待用户运行 `resume`

`resume` 会读取 checkpoint，应用审批结果，然后继续执行后续节点。

## Workflow vs Agent

Workflow 适合步骤固定、需要可审计和可恢复的流程。

Agent 适合下一步需要根据观察结果动态决定的探索型任务。

内容创作审批就是 Workflow 的典型场景：生成、评审、修改、人工审批、发布这些步骤很稳定。
