# Week 10：Workflow 工作流

## 本周目标

掌握确定性流程编排，并理解：

- DAG：固定节点和边
- 条件边：根据状态选择下一步
- 循环边：质量不达标时回到修改节点
- HITL：人工审批节点中断
- checkpoint：保存状态，支持 resume

## 代码位置

- 示例包：`examples/workflow-practice`
- 核心工作流：`examples/workflow-practice/src/lib/content-workflow.ts`
- checkpoint 存储：`examples/workflow-practice/src/lib/checkpoint-store.ts`
- 手动启动：`examples/workflow-practice/src/start.ts`
- 手动恢复：`examples/workflow-practice/src/resume.ts`
- 完整演示：`examples/workflow-practice/src/demo.ts`

## 内容创作 DAG

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

## HITL Resume

执行到 `humanApproval` 时，工作流会中断并保存 checkpoint：

```txt
.checkpoints/<threadId>.json
```

用户运行 resume 后：

```bash
pnpm week10:workflow:resume <threadId> approve "内容可以发布"
```

系统会读取 checkpoint，写入人工审批结果，然后继续执行 `publish`。

## 和 LangGraph 概念的对应

| 本示例 | LangGraph 概念 |
|--------|----------------|
| `ContentWorkflowState` | State |
| `briefNode` / `draftNode` 等函数 | Graph node |
| `nextNode` | Edge / conditional edge |
| `humanApprovalNode` | `interrupt()` |
| `.checkpoints/*.json` | `MemorySaver` / checkpoint |
| `resumeContentWorkflow()` | `Command({ resume })` 一类恢复流程 |

## 验收结果

- `pnpm week10:workflow:demo` 能完整演示：启动 → HITL 中断 → resume → 发布完成
- `pnpm week10:workflow:start` 能停在人工审批节点
- `pnpm week10:workflow:resume` 能从 checkpoint 继续执行

## 选型理解

Workflow 适合步骤稳定、可审计、可恢复的业务流程。

Agent 适合下一步不确定、需要根据工具结果动态调整的探索任务。

生产系统常见做法是：主流程用 Workflow 固定住，某些需要判断或生成的节点内部再调用 Agent。
