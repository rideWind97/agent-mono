import type { ToolContext } from "./types.js";

type ToolFn = (ctx: ToolContext) => string;

const tools: Record<string, ToolFn> = {
  search: ({ task }) => `搜索结果：找到与“${task}”相关的 3 条资料摘要。`,
  calculator: ({ task }) => {
    const expr = task.match(/[\d+\-*/().\s]+/)?.[0]?.trim();
    if (!expr) return "计算器：未识别到可计算表达式。";
    try {
      // eslint-disable-next-line no-new-func
      const value = new Function(`"use strict"; return (${expr})`)();
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return "计算器：结果无效。";
      }
      return `计算器：${expr} = ${value}`;
    } catch {
      return "计算器：表达式解析失败。";
    }
  },
  code: ({ task }) => `代码工具：已生成伪代码草案（任务：${task}）。`,
};

export function selectTools(task: string): string[] {
  const picks: string[] = [];
  if (/计算|算|[\d+\-*/()]/.test(task)) picks.push("calculator");
  if (/代码|实现|函数|接口/.test(task)) picks.push("code");
  if (!picks.length) picks.push("search");
  if (/对比|总结|调研|资料/.test(task) && !picks.includes("search")) {
    picks.unshift("search");
  }
  return picks;
}

export function runTool(name: string, ctx: ToolContext): string {
  const fn = tools[name];
  if (!fn) return `未知工具: ${name}`;
  return fn(ctx);
}
