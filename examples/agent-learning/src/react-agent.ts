import { guardInput, humanApproval } from "./guardrails.js";
import { createMemory, pushShortTerm, writeLongTerm } from "./memory.js";
import { runTool, selectTools } from "./tools.js";
import type { AgentResult } from "./types.js";

export function runReActAgent(task: string): AgentResult {
  const memory = createMemory({
    longTerm: {
      userPreference: "喜欢结构化回答",
    },
  });
  const steps: AgentResult["steps"] = [];

  steps.push({ phase: "observe", detail: `收到任务: ${task}` });
  const guard = guardInput(task);
  if (guard.blocked) {
    const approval = humanApproval(task);
    steps.push({ phase: "think", detail: guard.reason || "命中安全策略" });
    steps.push({ phase: "act", detail: approval.message });
    const output = approval.approved
      ? "审批通过，继续执行。"
      : "任务被安全策略阻断，终止执行。";
    return { mode: "react", steps: [...steps, { phase: "final", detail: output }], output, memory };
  }

  const selected = selectTools(task);
  steps.push({ phase: "think", detail: `选择工具: ${selected.join(", ")}` });

  for (const tool of selected) {
    const result = runTool(tool, { task, memory });
    steps.push({ phase: "act", detail: `[${tool}] ${result}` });
    pushShortTerm(memory, `${tool}: ${result}`);
  }

  const summary = [
    "ReAct 总结：",
    ...memory.shortTerm.map((x, i) => `${i + 1}. ${x}`),
  ].join("\n");
  writeLongTerm(memory, "lastTask", task);

  return {
    mode: "react",
    steps: [...steps, { phase: "final", detail: "完成 ReAct 循环" }],
    output: summary,
    memory,
  };
}
