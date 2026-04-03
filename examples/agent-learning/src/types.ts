export interface AgentMemory {
  shortTerm: string[];
  longTerm: Record<string, string>;
}

export interface AgentStep {
  phase: "observe" | "think" | "act" | "final";
  detail: string;
}

export interface AgentResult {
  mode: "react" | "plan-execute" | "supervisor" | "swarm";
  steps: AgentStep[];
  output: string;
  memory: AgentMemory;
}

export interface ToolContext {
  task: string;
  memory: AgentMemory;
}
