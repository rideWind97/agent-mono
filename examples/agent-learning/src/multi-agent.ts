import { createMemory, pushShortTerm } from "./memory.js";
import { runTool } from "./tools.js";
import type { AgentResult } from "./types.js";

function researcher(task: string): string {
  return runTool("search", { task: `${task}（research）`, memory: createMemory() });
}

function analyst(task: string): string {
  return runTool("calculator", { task: `${task}（analysis）`, memory: createMemory() });
}

function coder(task: string): string {
  return runTool("code", { task: `${task}（coding）`, memory: createMemory() });
}

export function runSupervisorMode(task: string): AgentResult {
  const memory = createMemory();
  const steps: AgentResult["steps"] = [];
  steps.push({ phase: "observe", detail: `Supervisor 收到任务: ${task}` });
  steps.push({ phase: "think", detail: "拆分任务给 researcher / analyst / coder" });

  const research = researcher(task);
  const analysis = analyst(task);
  const coding = coder(task);

  pushShortTerm(memory, `researcher: ${research}`);
  pushShortTerm(memory, `analyst: ${analysis}`);
  pushShortTerm(memory, `coder: ${coding}`);

  steps.push({ phase: "act", detail: "专家 Agent 并行执行完成" });
  const output = [
    "Supervisor 汇总：",
    `- ${research}`,
    `- ${analysis}`,
    `- ${coding}`,
  ].join("\n");

  return {
    mode: "supervisor",
    steps: [...steps, { phase: "final", detail: "Supervisor 汇总完成" }],
    output,
    memory,
  };
}

export function runSwarmMode(task: string): AgentResult {
  const memory = createMemory();
  const steps: AgentResult["steps"] = [];
  steps.push({ phase: "observe", detail: `Swarm 起始任务: ${task}` });

  const hop1 = researcher(task);
  steps.push({ phase: "act", detail: `Agent-A(research) -> ${hop1}` });
  pushShortTerm(memory, `A: ${hop1}`);

  const hop2 = analyst(`${task} | based on: ${hop1}`);
  steps.push({ phase: "act", detail: `Agent-B(analysis) -> ${hop2}` });
  pushShortTerm(memory, `B: ${hop2}`);

  const hop3 = coder(`${task} | based on: ${hop2}`);
  steps.push({ phase: "act", detail: `Agent-C(coding) -> ${hop3}` });
  pushShortTerm(memory, `C: ${hop3}`);

  const output = [
    "Swarm 接力结果：",
    ...memory.shortTerm,
  ].join("\n");

  return {
    mode: "swarm",
    steps: [...steps, { phase: "final", detail: "Swarm 协作完成" }],
    output,
    memory,
  };
}
