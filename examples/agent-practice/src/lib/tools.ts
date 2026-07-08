import type { ToolCall, ToolResult } from "./types.js";

interface WeatherInfo {
  city: string;
  condition: string;
  temperature: number;
  suggestion: string;
}

const weatherTable: Record<string, Omit<WeatherInfo, "city">> = {
  北京: { condition: "晴", temperature: 8, suggestion: "早晚偏冷，建议穿外套。" },
  上海: { condition: "小雨", temperature: 14, suggestion: "有小雨，建议带伞。" },
  广州: { condition: "多云", temperature: 23, suggestion: "气温舒适，薄外套即可。" },
};

const knowledgeBase: Record<string, string> = {
  react:
    "ReAct = Reasoning + Acting，适合不确定问题、排错和需要边观察边调整的多步任务。",
  workflow:
    "Workflow 是确定性流程编排，适合步骤稳定、可审计、需要上线可靠性的业务流程。",
  supervisor:
    "Supervisor 是调度型 Agent，负责拆分任务，并把子任务分配给 researcher、calculator、writer 等专业 Agent。",
};

function assertCity(city: unknown): string {
  if (typeof city !== "string" || !(city in weatherTable)) {
    throw new Error(`不支持的城市：${String(city)}`);
  }

  return city;
}

function getWeather(cityInput: unknown): WeatherInfo {
  const city = assertCity(cityInput);
  const weather = weatherTable[city];

  if (!weather) {
    throw new Error(`不支持的城市：${city}`);
  }

  return { city, ...weather };
}

function calculateTemperatureDiff(leftInput: unknown, rightInput: unknown) {
  if (typeof leftInput !== "number" || typeof rightInput !== "number") {
    throw new Error("calculate_temperature_diff 需要两个数字温度");
  }

  return {
    left: leftInput,
    right: rightInput,
    diff: Math.abs(leftInput - rightInput),
  };
}

function buildTravelAdvice(summaryInput: unknown, diffInput: unknown) {
  const summary = typeof summaryInput === "string" ? summaryInput : "";
  const diff = typeof diffInput === "number" ? diffInput : 0;
  const diffAdvice = diff >= 8 ? "两地温差明显，建议分层穿搭。" : "两地温差不大，按较冷城市准备即可。";
  const rainAdvice = summary.includes("雨") ? "其中有城市下雨，记得带伞。" : "暂无明显降雨提醒。";

  return `${diffAdvice}${rainAdvice}`;
}

function searchKnowledge(queryInput: unknown) {
  const query = typeof queryInput === "string" ? queryInput.toLowerCase() : "";
  const entries = Object.entries(knowledgeBase);
  const matched = entries.find(([key]) => query.includes(key)) ?? entries[0];

  if (!matched) {
    return "知识库没有找到相关内容。";
  }

  return matched[1];
}

function writeSummary(itemsInput: unknown) {
  const items = Array.isArray(itemsInput) ? itemsInput.map(String) : [];
  return [`汇总结果：`, ...items.map((item, index) => `${index + 1}. ${item}`)].join("\n");
}

// executeTool 是统一工具入口。
// ReAct Agent 和专业 Agent 都只需要传入 ToolCall，不需要关心具体函数在哪里。
export function executeTool(call: ToolCall): ToolResult {
  switch (call.name) {
    case "get_weather":
      return { name: call.name, result: getWeather(call.args.city) };
    case "calculate_temperature_diff":
      return {
        name: call.name,
        result: calculateTemperatureDiff(call.args.left, call.args.right),
      };
    case "build_travel_advice":
      return {
        name: call.name,
        result: buildTravelAdvice(call.args.summary, call.args.diff),
      };
    case "search_knowledge":
      return { name: call.name, result: searchKnowledge(call.args.query) };
    case "write_summary":
      return { name: call.name, result: writeSummary(call.args.items) };
    default:
      throw new Error(`未知工具：${call.name}`);
  }
}
