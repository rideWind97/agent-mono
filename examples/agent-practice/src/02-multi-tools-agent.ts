/**
 * ============================================================
 * Part 2: 多工具 Agent —— 搜索、计算、代码执行的智能编排
 * ============================================================
 *
 * 上一节的 ReAct Agent 只有 2 个工具，本节扩展到 5 个工具，
 * 重点学习 Agent 如何在多个工具中做出正确选择。
 *
 * 核心知识点：
 *   1. 工具选择：LLM 根据工具的 description 决定调用哪个工具
 *   2. 工具编排：一个问题可能需要多次调用不同工具（串行/并行）
 *   3. System Prompt 的重要性：引导 Agent 的工具使用策略
 *   4. recursionLimit：防止 Agent 陷入无限循环
 *
 * 关键设计：
 *   - 好的 tool description 是 Agent 准确选择工具的前提
 *   - System Prompt 可以指导 Agent 的决策偏好（先搜索再计算等）
 *   - 5 个工具足够覆盖大部分 Agent 场景：信息检索、数值计算、代码执行、天气查询、时间查询
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { createLLM, printSection, printStep } from "./config.js";
import { allTools } from "./tools.js";

/**
 * 创建带有 System Prompt 的多工具 Agent
 *
 * System Prompt 的作用：
 * - 定义 Agent 的角色和行为边界
 * - 指导工具使用策略（如「不确定时先搜索」）
 * - 规定输出格式（如「用中文回答」）
 *
 * 与纯 LLM 调用的区别：
 * - 纯 LLM：只能用自身知识回答
 * - Agent + 工具：可以调用外部工具获取实时信息，突破知识截止日期限制
 */
function createMultiToolAgent() {
  const llm = createLLM();

  const systemPrompt = `你是一个全能助手，拥有以下工具：
- get_weather: 查询城市天气
- calculator: 计算数学表达式
- code_executor: 执行 JavaScript 代码
- search_knowledge: 搜索技术知识库
- get_current_time: 获取当前时间

使用策略：
1. 遇到不确定的事实性问题，先用 search_knowledge 搜索
2. 遇到数学计算，用 calculator（简单）或 code_executor（复杂逻辑）
3. 需要多个信息时，可以连续调用多个工具
4. 工具返回结果后，整合信息给出完整回答
5. 用中文回答，保持简洁清晰`;

  return createReactAgent({
    llm,
    tools: allTools,
    // stateModifier 在每次 LLM 调用前修改消息列表
    // 这里用它来注入 System Prompt
    stateModifier: systemPrompt,
  });
}

/**
 * 执行查询并详细打印推理过程
 *
 * 使用 streamEvents v2 来观察完整的 Agent 执行流：
 * - on_tool_start / on_tool_end: 工具调用事件
 * - on_chat_model_stream: LLM 流式输出
 *
 * streamEvents 的优势：
 * - 能看到每一步的实时细节（逐 token、逐事件）
 * - 适合构建 UI 层的实时反馈（如「正在调用天气工具...」）
 */
async function runQuery(query: string) {
  printSection(`多工具 Agent: "${query}"`);

  const agent = createMultiToolAgent();

  const eventStream = agent.streamEvents(
    { messages: [new HumanMessage(query)] },
    {
      version: "v2",
      // recursionLimit 限制最大循环次数，防止 Agent 死循环
      // 每次 agent→tools 算 2 步，所以 15 大约允许 7 轮工具调用
      recursionLimit: 15,
    }
  );

  let finalAnswer = "";

  for await (const event of eventStream) {
    // 工具调用开始：Agent 决定使用某个工具
    if (event.event === "on_tool_start") {
      printStep("think", `决定调用工具: ${event.name}`);
      printStep("act", `参数: ${JSON.stringify(event.data?.input)}`);
    }

    // 工具调用完成：观察工具返回的结果
    if (event.event === "on_tool_end") {
      const rawOutput = event.data?.output;
      const output = typeof rawOutput === "string"
        ? rawOutput
        : typeof rawOutput?.content === "string"
          ? rawOutput.content
          : JSON.stringify(rawOutput);
      printStep("observe", `工具结果: ${output.slice(0, 200)}`);
    }

    // LLM 流式输出最终回答
    if (event.event === "on_chat_model_stream") {
      const content = event.data?.chunk?.content;
      if (typeof content === "string" && content) {
        finalAnswer += content;
      }
    }
  }

  if (finalAnswer) {
    printStep("result", `最终回答:\n${finalAnswer}`);
  }
}

// ============================================================
// 主函数：多种场景测试
// ============================================================

async function main() {
  console.log("🔧 Agent 实战 Part 2: 多工具 Agent\n");
  console.log("5 个工具：天气、计算器、代码执行、知识搜索、时间查询");
  console.log("Agent 根据问题自动选择合适的工具组合\n");

  // 场景 1: 知识搜索 → 只需要 search_knowledge
  await runQuery("LangChain 是什么框架？有什么核心概念？");

  // 场景 2: 多工具组合 → search_knowledge + calculator
  await runQuery("什么是 RAG？如果一个 RAG 系统每天处理 1000 个请求，每个请求平均检索 5 个文档片段，一个月总共检索多少个片段？");

  // 场景 3: 代码执行 → code_executor
  await runQuery("用 JavaScript 写一个函数，计算斐波那契数列第 10 项的值，并执行它");

  // 场景 4: 天气 + 时间组合 → get_weather + get_current_time
  await runQuery("现在几点了？杭州天气怎么样？我打算去西湖散步");
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
