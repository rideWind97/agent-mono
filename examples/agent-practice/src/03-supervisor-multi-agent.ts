/**
 * ============================================================
 * Part 3: Supervisor 多 Agent 系统 —— 多个专家协作完成复杂任务
 * ============================================================
 *
 * 多 Agent 系统的核心模式：
 *
 * 1. Supervisor（主管调度）模式：
 *    - 一个 Supervisor Agent 负责任务拆分和调度
 *    - 多个专家 Agent 各自负责自己的领域
 *    - Supervisor 收集各专家结果，汇总出最终答案
 *    - 适合：任务可以明确拆分为独立子任务的场景
 *
 *    ┌──────────────┐
 *    │  Supervisor  │ ← 用户输入
 *    │  (调度中心)   │
 *    └───┬──┬──┬────┘
 *        │  │  │
 *    ┌───▼┐┌▼──┐┌▼────┐
 *    │研究 ││分析││编码  │ ← 专家 Agent
 *    │Agent││Agent││Agent│
 *    └───┬┘└┬──┘└┬────┘
 *        │  │    │
 *    ┌───▼──▼────▼────┐
 *    │   Supervisor   │ → 汇总输出
 *    │   (汇总结果)    │
 *    └────────────────┘
 *
 * 2. Swarm（蜂群接力）模式：
 *    - Agent 之间以接力方式传递任务
 *    - 每个 Agent 完成自己的部分，将结果传给下一个
 *    - 适合：任务有明确的前后依赖关系的场景
 *
 *    Agent-A → Agent-B → Agent-C → 最终结果
 *    (研究)    (分析)     (编码)
 *
 * 本文件用 LangGraph StateGraph 手动构建 Supervisor 模式，
 * 展示状态图（节点 + 边 + 条件分支）的完整用法。
 */

import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createLLM, printSection, printStep } from "./config.js";

// ============================================================
// 第一步：定义状态 Schema
// ============================================================

/**
 * Annotation 定义 StateGraph 的状态结构
 *
 * 为什么需要状态？
 * - 多 Agent 之间需要共享数据（用户输入、中间结果、最终输出）
 * - StateGraph 的每个节点都能读写这个共享状态
 * - 状态在整个工作流生命周期中保持一致
 *
 * 设计技巧：
 * - userTask: 原始用户输入（只读，各 Agent 都需要参考）
 * - subtasks: Supervisor 拆分后的子任务列表
 * - results: 各专家 Agent 的执行结果（按角色存储）
 * - finalAnswer: 最终汇总的答案
 * - currentAgent: 追踪当前执行到哪个 Agent
 */
const SupervisorState = Annotation.Root({
  userTask: Annotation<string>(),
  subtasks: Annotation<string[]>(),
  results: Annotation<Record<string, string>>(),
  finalAnswer: Annotation<string>(),
  currentAgent: Annotation<string>(),
});

// ============================================================
// 第二步：定义各个 Agent 节点
// ============================================================

/**
 * Supervisor 节点：任务拆分
 *
 * 这是整个系统的「大脑」，负责：
 * 1. 理解用户的复杂需求
 * 2. 将大任务拆分为可执行的子任务
 * 3. 决定需要哪些专家参与
 */
async function supervisorPlan(state: typeof SupervisorState.State) {
  const llm = createLLM();
  printStep("think", "Supervisor 正在分析任务并制定计划...");

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个任务调度主管。请分析以下任务，拆分为 3 个子任务。
每个子任务一行，格式为：[角色] 子任务描述
可用角色：researcher（调研）、analyst（分析）、coder（编码）

用户任务：{task}

请直接输出子任务列表，不要其他内容：`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const planText = await chain.invoke({ task: state.userTask });

  const subtasks = planText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  printStep("act", `拆分为 ${subtasks.length} 个子任务:\n${subtasks.map((s) => `  • ${s}`).join("\n")}`);

  return {
    subtasks,
    currentAgent: "researcher",
  };
}

/**
 * Researcher Agent：信息调研专家
 *
 * 负责收集和整理背景信息
 * 在真实系统中，这里会接入搜索引擎、知识库等工具
 */
async function researcherAgent(state: typeof SupervisorState.State) {
  const llm = createLLM();
  printStep("act", "Researcher Agent 开始调研...");

  const researchTask = state.subtasks.find((s) => s.toLowerCase().includes("researcher")) || state.subtasks[0] || state.userTask;

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个技术调研专家。请针对以下任务进行简要调研，提供关键信息和发现。
控制在 150 字以内。

任务：{task}
背景：{userTask}`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const result = await chain.invoke({ task: researchTask, userTask: state.userTask });

  printStep("observe", `Researcher 输出: ${result.slice(0, 100)}...`);

  return {
    results: { ...state.results, researcher: result },
    currentAgent: "analyst",
  };
}

/**
 * Analyst Agent：数据分析专家
 *
 * 基于 Researcher 的调研结果进行深入分析
 * 体现了 Agent 之间的上下文传递：当前 Agent 能看到之前 Agent 的输出
 */
async function analystAgent(state: typeof SupervisorState.State) {
  const llm = createLLM();
  printStep("act", "Analyst Agent 开始分析...");

  const analysisTask = state.subtasks.find((s) => s.toLowerCase().includes("analyst")) || state.subtasks[1] || state.userTask;

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个数据分析专家。基于已有的调研结果，进行深入分析。
控制在 150 字以内。

分析任务：{task}
调研结果：{researchResult}
原始需求：{userTask}`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const result = await chain.invoke({
    task: analysisTask,
    researchResult: state.results.researcher || "暂无调研结果",
    userTask: state.userTask,
  });

  printStep("observe", `Analyst 输出: ${result.slice(0, 100)}...`);

  return {
    results: { ...state.results, analyst: result },
    currentAgent: "coder",
  };
}

/**
 * Coder Agent：编码实现专家
 *
 * 基于调研和分析结果，给出技术方案或代码建议
 */
async function coderAgent(state: typeof SupervisorState.State) {
  const llm = createLLM();
  printStep("act", "Coder Agent 开始编码方案设计...");

  const codingTask = state.subtasks.find((s) => s.toLowerCase().includes("coder")) || state.subtasks[2] || state.userTask;

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个技术方案专家。基于调研和分析结果，给出具体的技术方案或代码建议。
控制在 150 字以内。

编码任务：{task}
调研结果：{researchResult}
分析结果：{analysisResult}
原始需求：{userTask}`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const result = await chain.invoke({
    task: codingTask,
    researchResult: state.results.researcher || "",
    analysisResult: state.results.analyst || "",
    userTask: state.userTask,
  });

  printStep("observe", `Coder 输出: ${result.slice(0, 100)}...`);

  return {
    results: { ...state.results, coder: result },
    currentAgent: "supervisor",
  };
}

/**
 * Supervisor 汇总节点：整合所有专家的输出
 *
 * 这是工作流的最后一步：
 * - 收集 researcher、analyst、coder 三位专家的结果
 * - 由 LLM 做最终的整合和润色
 * - 输出结构清晰的最终答案
 */
async function supervisorSummarize(state: typeof SupervisorState.State) {
  const llm = createLLM();
  printStep("think", "Supervisor 正在汇总所有专家结果...");

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是任务调度主管。现在需要汇总三位专家的工作成果，给出完整的最终答案。

原始任务：{userTask}

调研结果：
{researchResult}

分析结果：
{analysisResult}

技术方案：
{coderResult}

请整合以上内容，输出一份结构清晰、内容完整的最终报告。`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const finalAnswer = await chain.invoke({
    userTask: state.userTask,
    researchResult: state.results.researcher || "无",
    analysisResult: state.results.analyst || "无",
    coderResult: state.results.coder || "无",
  });

  return { finalAnswer };
}

// ============================================================
// 第三步：构建 StateGraph
// ============================================================

/**
 * 构建 Supervisor 模式的多 Agent 工作流
 *
 * StateGraph 的核心概念：
 * - addNode(name, fn): 添加一个处理节点（fn 接收 state，返回 state 的更新部分）
 * - addEdge(from, to): 添加确定性边（from 执行完必然走 to）
 * - addConditionalEdges(from, routerFn): 添加条件边（根据 routerFn 的返回值决定下一个节点）
 * - START / END: 内置的起点和终点
 * - compile(): 编译图，生成可执行的 Runnable
 *
 * 本工作流的拓扑结构：
 * START → supervisorPlan → researcher → analyst → coder → supervisorSummarize → END
 */
function buildSupervisorGraph() {
  const graph = new StateGraph(SupervisorState)
    // 注册所有节点
    .addNode("supervisorPlan", supervisorPlan)
    .addNode("researcher", researcherAgent)
    .addNode("analyst", analystAgent)
    .addNode("coder", coderAgent)
    .addNode("supervisorSummarize", supervisorSummarize)

    // 定义执行流程
    .addEdge(START, "supervisorPlan")         // 起点 → 任务拆分
    .addEdge("supervisorPlan", "researcher")   // 拆分后 → 调研
    .addEdge("researcher", "analyst")          // 调研 → 分析
    .addEdge("analyst", "coder")               // 分析 → 编码
    .addEdge("coder", "supervisorSummarize")   // 编码 → 汇总
    .addEdge("supervisorSummarize", END)       // 汇总 → 结束

    .compile();

  return graph;
}

/**
 * 运行 Supervisor 多 Agent 系统
 */
async function runSupervisor(task: string) {
  printSection(`Supervisor 多 Agent: "${task}"`);

  const graph = buildSupervisorGraph();

  // invoke() 会执行整个图直到 END 节点
  const result = await graph.invoke({
    userTask: task,
    subtasks: [],
    results: {},
    finalAnswer: "",
    currentAgent: "",
  });

  printStep("result", `\n${"─".repeat(40)}\n最终报告:\n${result.finalAnswer}`);
  return result;
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("👥 Agent 实战 Part 3: Supervisor 多 Agent 系统\n");
  console.log("Supervisor 负责任务拆分 → 分发给专家 Agent → 汇总结果\n");

  // 场景 1: 技术选型任务
  await runSupervisor("对比 React 和 Vue 框架的优劣，给出 2025 年新项目的选型建议");

  // 场景 2: 系统设计任务
  await runSupervisor("设计一个基于 RAG 的智能客服系统，需要支持多轮对话和知识库更新");
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
