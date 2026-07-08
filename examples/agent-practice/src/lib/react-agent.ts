import { executeTool } from "./tools.js";
import type { ReactAgentResult, ToolCall, TraceStep } from "./types.js";

interface Scratchpad {
  beijingTemperature?: number;
  shanghaiTemperature?: number;
  weatherSummary?: string;
  temperatureDiff?: number;
  advice?: string;
}

function pushThought(trace: TraceStep[], content: string) {
  trace.push({ type: "thought", content });
}

function pushAction(trace: TraceStep[], call: ToolCall) {
  trace.push({
    type: "action",
    content: `${call.name}(${JSON.stringify(call.args)})`,
  });
}

function pushObservation(trace: TraceStep[], content: string) {
  trace.push({ type: "observation", content });
}

function decideNextAction(scratchpad: Scratchpad): ToolCall | null {
  // 这里用规则模拟 LLM 的“下一步决策”。
  // 真实 ReAct Agent 会让模型根据当前 trace 选择工具和参数。
  if (typeof scratchpad.beijingTemperature !== "number") {
    return { name: "get_weather", args: { city: "北京" } };
  }

  if (typeof scratchpad.shanghaiTemperature !== "number") {
    return { name: "get_weather", args: { city: "上海" } };
  }

  if (typeof scratchpad.temperatureDiff !== "number") {
    return {
      name: "calculate_temperature_diff",
      args: {
        left: scratchpad.beijingTemperature,
        right: scratchpad.shanghaiTemperature,
      },
    };
  }

  if (!scratchpad.advice) {
    return {
      name: "build_travel_advice",
      args: {
        summary: scratchpad.weatherSummary,
        diff: scratchpad.temperatureDiff,
      },
    };
  }

  return null;
}

function updateScratchpad(scratchpad: Scratchpad, call: ToolCall, result: unknown) {
  if (call.name === "get_weather") {
    const weather = result as { city: string; condition: string; temperature: number; suggestion: string };
    const summary = `${weather.city}${weather.condition}${weather.temperature}度，${weather.suggestion}`;

    scratchpad.weatherSummary = scratchpad.weatherSummary
      ? `${scratchpad.weatherSummary}；${summary}`
      : summary;

    if (weather.city === "北京") {
      scratchpad.beijingTemperature = weather.temperature;
    }

    if (weather.city === "上海") {
      scratchpad.shanghaiTemperature = weather.temperature;
    }
  }

  if (call.name === "calculate_temperature_diff") {
    scratchpad.temperatureDiff = (result as { diff: number }).diff;
  }

  if (call.name === "build_travel_advice") {
    scratchpad.advice = String(result);
  }
}

function validateFinalAnswer(answer: string) {
  // Guardrail：最终回答至少要包含天气摘要、温差和建议。
  // 真实项目里这里可以换成 Zod schema、敏感操作拦截或安全策略。
  return answer.includes("温差") && answer.includes("建议");
}

export function runReactWeatherAgent(
  task = "比较北京和上海天气，计算温差，并给出出行建议。",
): ReactAgentResult {
  const trace: TraceStep[] = [];
  const scratchpad: Scratchpad = {};

  pushThought(trace, `用户任务是：${task}`);
  pushThought(trace, "我需要先查询两个城市天气，再计算温差，最后生成建议。");

  for (let step = 0; step < 8; step++) {
    const call = decideNextAction(scratchpad);

    if (!call) {
      break;
    }

    pushThought(trace, "根据当前观察结果，我选择下一个工具。");
    pushAction(trace, call);

    const toolResult = executeTool(call);
    updateScratchpad(scratchpad, call, toolResult.result);
    pushObservation(trace, JSON.stringify(toolResult.result));
  }

  const answer = [
    scratchpad.weatherSummary ?? "天气信息不足。",
    `温差：${scratchpad.temperatureDiff ?? "未知"}度。`,
    `建议：${scratchpad.advice ?? "建议按较冷城市准备。"}`,
  ].join("\n");

  if (!validateFinalAnswer(answer)) {
    trace.push({ type: "guardrail", content: "最终回答缺少必要字段，已触发 guardrail。" });
  }

  trace.push({ type: "final", content: answer });

  return {
    task,
    answer,
    trace,
  };
}
