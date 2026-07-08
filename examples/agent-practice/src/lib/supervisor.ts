import { executeTool } from "./tools.js";
import type { SupervisorResult, SupervisorTask, TraceStep, WorkerResult } from "./types.js";

function buildPlan(): SupervisorTask[] {
  // Supervisor 的核心不是自己做所有事，而是“拆分 + 分派”。
  // 这里用固定规则模拟调度计划，真实项目里可以让 LLM 生成 plan。
  return [
    {
      id: "research-agent",
      assignee: "researcher",
      instruction: "调研 ReAct 和 Workflow 的适用场景。",
    },
    {
      id: "estimate-agent",
      assignee: "calculator",
      instruction: "估算 ReAct demo 2 小时和 Workflow demo 3 小时的总工时。",
    },
    {
      id: "writer-agent",
      assignee: "writer",
      instruction: "把研究和计算结果整理成面向初学者的总结。",
    },
  ];
}

function runResearcher(task: SupervisorTask): WorkerResult {
  const react = executeTool({ name: "search_knowledge", args: { query: "react" } }).result;
  const workflow = executeTool({ name: "search_knowledge", args: { query: "workflow" } }).result;

  return {
    agent: task.assignee,
    taskId: task.id,
    output: [`${task.instruction}`, `ReAct：${react}`, `Workflow：${workflow}`].join("\n"),
  };
}

function runCalculator(task: SupervisorTask): WorkerResult {
  // 为了保持工具接口简单，这里直接做确定性计算。
  // 重点是展示 calculator Agent 只负责数字类子任务。
  const reactHours = 2;
  const workflowHours = 3;
  const total = reactHours + workflowHours;

  return {
    agent: task.assignee,
    taskId: task.id,
    output: `${task.instruction} 结果：${reactHours} + ${workflowHours} = ${total} 小时。`,
  };
}

function runWriter(task: SupervisorTask, previousResults: WorkerResult[]): WorkerResult {
  const summary = executeTool({
    name: "write_summary",
    args: {
      items: previousResults.map((result) => `${result.agent}: ${result.output}`),
    },
  }).result;

  return {
    agent: task.assignee,
    taskId: task.id,
    output: `${task.instruction}\n${String(summary)}`,
  };
}

function runWorker(task: SupervisorTask, previousResults: WorkerResult[]) {
  if (task.assignee === "researcher") {
    return runResearcher(task);
  }

  if (task.assignee === "calculator") {
    return runCalculator(task);
  }

  return runWriter(task, previousResults);
}

export function runSupervisorAgent(
  task = "解释 ReAct 和 Workflow 的区别，并估算做两个 demo 的总工时。",
): SupervisorResult {
  const trace: TraceStep[] = [];
  const plan = buildPlan();
  const workerResults: WorkerResult[] = [];

  trace.push({ type: "thought", content: `Supervisor 收到任务：${task}` });
  trace.push({ type: "thought", content: "我会把任务拆给 researcher、calculator、writer 三类专业 Agent。" });

  for (const subTask of plan) {
    trace.push({
      type: "action",
      content: `dispatch(${subTask.assignee}, ${JSON.stringify(subTask.instruction)})`,
    });

    const result = runWorker(subTask, workerResults);
    workerResults.push(result);

    trace.push({
      type: "observation",
      content: `${result.agent} 完成：${result.output}`,
    });
  }

  const answer = [
    "Supervisor 最终汇总：",
    ...workerResults.map((result) => `- ${result.agent}: ${result.output}`),
    "",
    "选型原则：不确定、需要探索的问题适合 Agent/ReAct；步骤稳定、要可控上线的业务流程适合 Workflow。",
  ].join("\n");

  trace.push({ type: "final", content: answer });

  return {
    task,
    plan,
    workerResults,
    answer,
    trace,
  };
}
