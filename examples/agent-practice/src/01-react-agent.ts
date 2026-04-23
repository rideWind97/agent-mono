/**
 * ============================================================
 * Part 1: ReAct Agent —— 推理与行动循环
 * ============================================================
 *
 * ReAct（Reasoning + Acting）核心思想：
 *   LLM 不仅输出最终答案，而是交替进行「思考」和「行动」：
 *   1. Observe（感知）：接收用户输入
 *   2. Think（推理）：LLM 分析当前状态，决定下一步该做什么
 *   3. Act（行动）：调用工具获取信息
 *   4. Observe（感知）：观察工具返回的结果
 *   5. 重复 2-4，直到 LLM 认为可以给出最终答案
 *
 * 为什么用 LangGraph 实现 ReAct：
 *   - LangGraph 的 createReactAgent() 内部已实现了上述循环
 *   - 它构建了一个状态图：LLM 节点 ↔ 工具节点，通过条件边决定是否继续循环
 *   - 状态中保存完整的消息历史（messages），每次循环都能看到之前的推理和工具结果
 *
 * 本文件演示：
 *   1. 最简 ReAct Agent：2 个工具（天气 + 计算器）
 *   2. 观察 Agent 的完整推理过程（通过 streamEvents）
 *   3. 理解 Agent 何时决定调用工具、何时直接回答
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";

import { createLLM, printSection, printStep } from "./config.js";
import { basicTools } from "./tools.js";

/**
 * 创建一个最基本的 ReAct Agent
 *
 * createReactAgent 做了什么？
 * 1. 创建一个 StateGraph，状态包含 messages 数组
 * 2. 添加 "agent" 节点：调用 LLM，LLM 可能返回文本或 tool_calls
 * 3. 添加 "tools" 节点：执行 LLM 请求的工具调用
 * 4. 添加条件边：如果 LLM 返回了 tool_calls → 走 tools 节点 → 回到 agent 节点
 *                 如果 LLM 没有 tool_calls → 结束（说明 LLM 认为已经可以回答了）
 *
 * 这就是 ReAct 循环的本质：
 * ┌─────────┐   有 tool_calls   ┌──────────┐
 * │  Agent  │ ───────────────→ │  Tools   │
 * │  (LLM)  │ ←─────────────── │ (执行器) │
 * └────┬────┘   工具结果返回     └──────────┘
 *      │ 无 tool_calls（最终回答）
 *      ↓
 *   [END] 输出结果
 */
function createBasicReActAgent() {
  const llm = createLLM();

  // createReactAgent 是 LangGraph 的预构建函数，一行代码创建完整的 ReAct Agent
  // llm: 决策用的大语言模型
  // tools: Agent 可使用的工具列表
  const agent = createReactAgent({
    llm,
    tools: basicTools,
  });

  return agent;
}

/**
 * 运行 Agent 并通过 streamEvents 观察完整的推理过程
 *
 * streamEvents 是 LangGraph 的核心调试手段，它会发出以下事件：
 * - on_chat_model_start: LLM 开始推理
 * - on_chat_model_stream: LLM 逐 token 输出
 * - on_tool_start: 开始调用工具
 * - on_tool_end: 工具调用完成
 * - on_chat_model_end: LLM 推理结束
 *
 * 通过这些事件，我们可以清楚看到 ReAct 的每一步：
 * 「思考 → 决定调工具 → 执行工具 → 观察结果 → 再思考 → 输出答案」
 */
async function runWithEventStream(query: string) {
  printSection(`ReAct Agent: "${query}"`);

  const agent = createBasicReActAgent();
  let stepCount = 0;

  // streamEvents(input, options) 返回一个异步迭代器
  // version: "v2" 使用最新的事件格式
  const eventStream = agent.streamEvents(
    { messages: [new HumanMessage(query)] },
    { version: "v2", recursionLimit: 10 }
  );

  let finalAnswer = "";

  for await (const event of eventStream) {
    // ── 事件 1：LLM 开始推理（每轮循环的起点）──
    if (event.event === "on_chat_model_start") {
      stepCount++;
      printStep("think", `第 ${stepCount} 轮推理开始...`);
    }

    // ── 事件 2：工具被调用 ──
    // 说明 LLM 在思考后决定需要外部信息
    if (event.event === "on_tool_start") {
      printStep("act", `调用工具: ${event.name}(${JSON.stringify(event.data?.input)})`);
    }

    // ── 事件 3：工具返回结果 ──
    // Agent 会把这个结果放入消息历史，供下轮推理使用
    if (event.event === "on_tool_end") {
      const output = typeof event.data?.output === "string"
        ? event.data.output
        : event.data?.output?.content ?? JSON.stringify(event.data?.output);
      printStep("observe", `工具返回: ${output}`);
    }

    // ── 事件 4：LLM 流式输出最终回答 ──
    if (event.event === "on_chat_model_stream") {
      const content = event.data?.chunk?.content;
      if (typeof content === "string" && content) {
        finalAnswer += content;
      }
    }
  }

  printStep("result", `最终回答:\n${finalAnswer}`);
  return finalAnswer;
}

// ============================================================
// 主函数：运行多个测试用例
// ============================================================

async function main() {
  console.log("🤖 Agent 实战 Part 1: ReAct Agent\n");
  console.log("ReAct = Reasoning + Acting");
  console.log("Agent 在「思考」和「行动」之间交替循环，直到找到答案\n");

  // 用例 1: 需要调用工具才能回答的问题
  // 期望：Agent 调用 get_weather → 观察结果 → 输出回答
  await runWithEventStream("北京今天天气怎么样？适合出门吗？");

  // 用例 2: 需要调用计算器的问题
  // 期望：Agent 调用 calculator → 观察结果 → 输出回答
  await runWithEventStream("帮我算一下 (156 + 289) * 3 - 100 等于多少");

  // 用例 3: 可能需要多轮工具调用
  // 期望：Agent 先查北京天气 → 再查上海天气 → 对比 → 输出结论
  await runWithEventStream("北京和上海哪个城市今天更热？温差是多少度？");

  // 用例 4: 不需要工具的问题（LLM 直接回答）
  // 期望：Agent 不调用任何工具，直接输出回答
  await runWithEventStream("什么是 ReAct 模式？请简单解释");
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
