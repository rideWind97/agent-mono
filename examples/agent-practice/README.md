# Agent Practice

Week 9 Agent 练习：用本地可运行的代码理解 ReAct 循环和 Supervisor 多 Agent。

这个示例故意不依赖真实 LLM。它用规则模拟“模型决策”，让你先看清楚 Agent 的执行轨迹：

- ReAct：Thought → Action → Observation → Thought → ... → Final
- Supervisor：拆任务 → 分派给专业 Agent → 收集结果 → 汇总

## 运行

```bash
pnpm --filter @agent-mono/agent-practice react
pnpm --filter @agent-mono/agent-practice supervisor
```

根命令：

```bash
pnpm week9:agent:react
pnpm week9:agent:supervisor
```

## 文件说明

- `src/lib/tools.ts`：示例工具集合，包含天气、计算、知识搜索、汇总工具
- `src/lib/react-agent.ts`：ReAct Agent，多步调用工具完成天气比较任务
- `src/lib/supervisor.ts`：Supervisor，多 Agent 拆分与调度示例
- `src/react-demo.ts`：打印 ReAct 执行轨迹
- `src/supervisor-demo.ts`：打印 Supervisor 计划与执行轨迹

## ReAct 和 Workflow 的区别

Agent / ReAct 适合不确定任务：下一步做什么要根据工具结果临时决定，例如排错、搜索、调研。

Workflow 适合确定任务：步骤稳定、顺序固定、需要可审计和可上线，例如审批流、订单处理、固定数据管道。

简单判断：

```txt
如果“每一步都能提前写死” -> Workflow
如果“下一步要看观察结果再决定” -> Agent / ReAct
如果“任务需要多个角色协作” -> Supervisor / Multi-Agent
```
