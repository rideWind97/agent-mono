# Week 9：Agent 智能体

## 本周目标

理解 Agent 和 Workflow 的区别，并用代码跑通两个核心模式：

- ReAct：边思考、边调用工具、边观察结果，再决定下一步
- Supervisor：一个调度 Agent 拆任务，把子任务分配给多个专业 Agent

## 代码位置

- 示例包：`examples/agent-practice`
- ReAct：`examples/agent-practice/src/lib/react-agent.ts`
- Supervisor：`examples/agent-practice/src/lib/supervisor.ts`
- 工具集合：`examples/agent-practice/src/lib/tools.ts`

## 运行命令

```bash
pnpm week9:agent:react
pnpm week9:agent:supervisor
```

## ReAct 执行轨迹

```txt
Thought: 我需要查询两个城市天气
Action: get_weather({ city: "北京" })
Observation: 北京天气结果
Thought: 还需要上海天气
Action: get_weather({ city: "上海" })
Observation: 上海天气结果
Action: calculate_temperature_diff(...)
Observation: 温差
Action: build_travel_advice(...)
Final: 天气、温差、建议
```

重点：ReAct 的下一步依赖上一步 Observation。它适合探索型任务。

## Supervisor 多 Agent

```txt
Supervisor
  -> researcher：调研 ReAct / Workflow
  -> calculator：计算 demo 总工时
  -> writer：整理最终总结
```

重点：Supervisor 自己不做全部工作，而是拆任务、路由、汇总结果。

## Agent vs Workflow

| 对比 | Agent / ReAct | Workflow |
|------|---------------|----------|
| 下一步 | 根据观察结果动态决定 | 预先固定 |
| 优势 | 灵活，适合探索 | 稳定，可控，可审计 |
| 风险 | 容易跑偏，需要 guardrails | 灵活性较低 |
| 适合 | 排错、搜索、调研、多工具探索 | 审批流、订单流、固定业务流程 |

选型原则：

- 不确定、需要边观察边调整：用 Agent / ReAct
- 步骤稳定、要上线可靠：用 Workflow
- 多角色协作：用 Supervisor / Multi-Agent
- 生产系统常见组合：Workflow 固定主流程，局部步骤使用 ReAct
