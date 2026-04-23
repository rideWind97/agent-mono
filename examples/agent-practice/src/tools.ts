/**
 * Agent 工具集定义
 *
 * 核心概念：
 * - LangChain 的 tool() 函数用于定义 Agent 可调用的工具
 * - 每个工具需要：name（名称）、description（描述）、schema（参数 Schema）
 * - Agent（LLM）根据 description 决定何时调用哪个工具
 * - schema 使用 Zod 定义参数类型，LangChain 会自动转为 JSON Schema 传给 LLM
 *
 * 设计原则：
 * - description 必须清晰，因为 LLM 靠它来决策（类似写给 AI 的 API 文档）
 * - 参数尽量少且明确，减少 LLM 出错概率
 * - 返回值为 string，方便 LLM 阅读（JSON 字符串也可以）
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================================
// 工具 1：天气查询（模拟）
// ============================================================

const WEATHER_DB: Record<string, { temp: number; condition: string; humidity: number }> = {
  北京: { temp: 22, condition: "晴", humidity: 35 },
  上海: { temp: 26, condition: "多云", humidity: 65 },
  广州: { temp: 30, condition: "雷阵雨", humidity: 80 },
  深圳: { temp: 29, condition: "阵雨", humidity: 78 },
  杭州: { temp: 25, condition: "阴", humidity: 60 },
  成都: { temp: 23, condition: "多云", humidity: 70 },
};

/**
 * 天气查询工具
 * 演示最基本的工具定义模式：接收参数 → 执行逻辑 → 返回结果字符串
 */
export const weatherTool = tool(
  async ({ city }) => {
    const data = WEATHER_DB[city];
    if (!data) {
      return `未找到城市 "${city}" 的天气数据。支持的城市：${Object.keys(WEATHER_DB).join("、")}`;
    }
    return JSON.stringify({
      city,
      temperature: `${data.temp}°C`,
      condition: data.condition,
      humidity: `${data.humidity}%`,
    });
  },
  {
    name: "get_weather",
    description: "查询指定城市的天气信息，返回温度、天气状况和湿度",
    schema: z.object({
      city: z.string().describe("中文城市名，如「北京」「上海」"),
    }),
  }
);

// ============================================================
// 工具 2：数学计算器
// ============================================================

/**
 * 计算器工具
 *
 * 安全设计要点：
 * - 只允许数字和基本运算符（白名单过滤）
 * - 使用 new Function 而非 eval，运行在严格模式下
 * - 对结果进行 isFinite 校验，防止 Infinity/NaN
 */
export const calculatorTool = tool(
  async ({ expression }) => {
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
    if (!sanitized.trim()) {
      return `不安全的表达式: "${expression}"，仅支持数字和 +, -, *, /, (), % 运算符`;
    }

    try {
      const result = new Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== "number" || !isFinite(result)) {
        return `计算结果无效: ${result}`;
      }
      return `${expression} = ${result}`;
    } catch (e) {
      return `计算出错: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "calculator",
    description: "计算数学表达式，支持加减乘除和括号。例如 (2 + 3) * 4",
    schema: z.object({
      expression: z.string().describe("数学表达式，如 '(2+3)*4' 或 '100/7'"),
    }),
  }
);

// ============================================================
// 工具 3：代码执行器（安全沙箱模拟）
// ============================================================

/**
 * 代码执行工具
 *
 * 实际生产中应该使用真正的沙箱（如 Docker、WebAssembly）
 * 这里用 new Function 模拟，仅支持简单的纯函数执行
 */
export const codeExecutorTool = tool(
  async ({ code }) => {
    if (code.length > 500) {
      return "代码过长（超过 500 字符），请简化";
    }
    // 安全检查：禁止危险操作
    const forbidden = ["require", "import", "process", "fs", "child_process", "eval", "fetch"];
    for (const keyword of forbidden) {
      if (code.includes(keyword)) {
        return `安全限制：代码中不允许使用 "${keyword}"`;
      }
    }
    try {
      const fn = new Function(`"use strict"; ${code}`);
      const result = fn();
      return `执行成功，返回值: ${JSON.stringify(result ?? "undefined")}`;
    } catch (e) {
      return `执行出错: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: "code_executor",
    description: "执行简单的 JavaScript 代码片段并返回结果。支持纯函数计算，不支持 I/O 操作",
    schema: z.object({
      code: z.string().describe("要执行的 JavaScript 代码，如 'return [1,2,3].reduce((a,b)=>a+b, 0)'"),
    }),
  }
);

// ============================================================
// 工具 4：知识搜索（模拟 RAG 检索）
// ============================================================

const KNOWLEDGE_BASE = [
  { topic: "React", content: "React 是 Meta 开发的前端 UI 库，采用虚拟 DOM 和组件化架构，支持 JSX 语法" },
  { topic: "Vue", content: "Vue 是渐进式 JavaScript 框架，核心是响应式数据绑定和组件系统，由尤雨溪创建" },
  { topic: "TypeScript", content: "TypeScript 是 JavaScript 的超集，添加了静态类型系统，由微软开发维护" },
  { topic: "LangChain", content: "LangChain 是构建 LLM 应用的开源框架，提供 Chain、Agent、Tool 等核心抽象" },
  { topic: "Agent", content: "AI Agent 是具备自主决策能力的智能体，核心是感知-推理-行动循环（Observe→Think→Act）" },
  { topic: "RAG", content: "RAG（检索增强生成）先检索相关文档，再将其作为上下文传给 LLM 生成回答，可有效减少幻觉" },
  { topic: "MCP", content: "MCP（Model Context Protocol）是 Anthropic 提出的标准化模型上下文协议，统一了工具接入方式" },
];

/**
 * 知识搜索工具
 * 模拟 RAG 检索：根据关键词匹配知识库，返回相关条目
 */
export const searchTool = tool(
  async ({ query }) => {
    const queryLower = query.toLowerCase();
    const matches = KNOWLEDGE_BASE.filter(
      (item) =>
        item.topic.toLowerCase().includes(queryLower) ||
        item.content.includes(query)
    );
    if (matches.length === 0) {
      return `未找到与 "${query}" 相关的知识条目`;
    }
    return matches
      .map((m) => `[${m.topic}] ${m.content}`)
      .join("\n");
  },
  {
    name: "search_knowledge",
    description: "搜索技术知识库，查找与查询相关的技术资料",
    schema: z.object({
      query: z.string().describe("搜索关键词，如 'React' 或 'Agent'"),
    }),
  }
);

// ============================================================
// 工具 5：获取当前时间
// ============================================================

export const currentTimeTool = tool(
  async ({ timezone }) => {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("zh-CN", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    return `当前时间（${timezone}）：${formatted}`;
  },
  {
    name: "get_current_time",
    description: "获取指定时区的当前时间",
    schema: z.object({
      timezone: z.string().default("Asia/Shanghai").describe("时区，如 'Asia/Shanghai'"),
    }),
  }
);

/** 基础工具集：天气 + 计算器 */
export const basicTools = [weatherTool, calculatorTool];

/** 完整工具集：所有 5 个工具 */
export const allTools = [
  weatherTool,
  calculatorTool,
  codeExecutorTool,
  searchTool,
  currentTimeTool,
];
