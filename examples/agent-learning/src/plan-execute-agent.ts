import { createMemory, pushShortTerm } from "./memory.js";
import { runTool } from "./tools.js";
import type { AgentResult } from "./types.js";

function makePlan(task: string): string[] {
  if (/对比|比较/.test(task)) {
    return [
      "收集两方信息",
      "提取差异点",
      "输出结论与建议",
    ];
  }
  if (/实现|开发/.test(task)) {
    return [
      "分析需求边界",
      "拆解实现步骤",
      "给出代码草案",
    ];
  }
  return ["检索背景信息", "提炼关键点", "输出结构化结论"];
}

export function runPlanExecuteAgent(task: string): AgentResult {
  const memory = createMemory();
  const steps: AgentResult["steps"] = [];

  steps.push({ phase: "observe", detail: `任务输入: ${task}` });
  const plan = makePlan(task);
  steps.push({ phase: "think", detail: `计划: ${plan.join(" -> ")}` });

  for (const p of plan) {
    const toolName = /代码|实现/.test(p) ? "code" : "search";
    const toolResult = runTool(toolName, { task: `${task} | 子任务:${p}`, memory });
    pushShortTerm(memory, `${p} => ${toolResult}`);
    steps.push({ phase: "act", detail: `${p}: 调用${toolName}` });
  }

  const output = [
    "Plan-and-Execute 输出：",
    ...memory.shortTerm.map((x, i) => `${i + 1}. ${x}`),
  ].join("\n");

  return {
    mode: "plan-execute",
    steps: [...steps, { phase: "final", detail: "计划执行完成" }],
    output,
    memory,
  };
}
