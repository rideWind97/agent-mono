// Week 9 的重点是理解 Agent 的“循环”和“调度”。
// 这个文件先把示例中会流动的数据结构定义出来。

export type TraceStepType = "thought" | "action" | "observation" | "final" | "guardrail";

// ReAct 轨迹里的每一步。
// 对应经典格式：Thought -> Action -> Observation -> Thought -> ... -> Final。
export interface TraceStep {
  type: TraceStepType;
  content: string;
}

// 工具调用计划。
// Agent 每次决定要行动时，会生成一个 ToolCall。
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

// 工具执行结果。
// Observation 就来自这里。
export interface ToolResult {
  name: string;
  result: unknown;
}

export interface ReactAgentResult {
  task: string;
  answer: string;
  trace: TraceStep[];
}

// Supervisor 拆出来的子任务。
// assignee 表示这个子任务交给哪个专业 Agent。
export interface SupervisorTask {
  id: string;
  assignee: "researcher" | "calculator" | "writer";
  instruction: string;
}

export interface WorkerResult {
  agent: SupervisorTask["assignee"];
  taskId: string;
  output: string;
}

export interface SupervisorResult {
  task: string;
  plan: SupervisorTask[];
  workerResults: WorkerResult[];
  answer: string;
  trace: TraceStep[];
}
