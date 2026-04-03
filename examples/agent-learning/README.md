# Agent Learning Demo

本示例用于学习：

- ReAct
- Plan-and-Execute
- Multi-Agent（Supervisor / Swarm）
- 短期/长期记忆
- Guard Rails + Human-in-the-loop

## 运行

```bash
cd examples/agent-learning
pnpm install
pnpm demo
```

## 输出内容

1. ReAct 循环轨迹（Observe → Think → Act）
2. Plan-and-Execute 的计划与执行步骤
3. Supervisor 调度专家 Agent 的过程
4. Swarm 协作接力流程
5. 高风险动作触发 Guard Rails + HITL

## 学习建议

- 先读 `src/react-agent.ts`
- 再看 `src/plan-execute-agent.ts`
- 再看 `src/multi-agent.ts`
- 最后看 `src/guardrails.ts` + `src/memory.ts`
