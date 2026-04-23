/**
 * ============================================================
 * Part 5: 工作流持久化与恢复 —— 跨会话的工作流
 * ============================================================
 *
 * 为什么需要持久化？
 *
 *   生产环境中的工作流可能：
 *   - 运行几分钟甚至几小时（长流程）
 *   - 需要跨请求保持状态（HITL 审批可能隔天才回复）
 *   - 进程重启后需要从断点恢复（不能从头再来）
 *   - 需要审计和回溯（看历史执行记录）
 *
 * LangGraph 的检查点（Checkpoint）机制：
 *
 *   1. MemorySaver（内存存储）—— 本 Demo 使用
 *      - 存在内存中，进程结束即丢失
 *      - 适合开发调试
 *
 *   2. SqliteSaver（SQLite 存储）—— 生产轻量方案
 *      - 持久化到文件，进程重启可恢复
 *
 *   3. PostgresSaver（PostgreSQL 存储）—— 生产推荐方案
 *      - 支持并发、事务、高可用
 *
 * 检查点保存了什么？
 *   - 完整的工作流状态（所有 Annotation 字段的值）
 *   - 当前执行到哪个节点
 *   - 消息历史（如果有 Agent 节点）
 *   - 通过 thread_id 区分不同的工作流实例
 *
 * 本文件演示：
 *   1. 用 MemorySaver 保存工作流状态
 *   2. 中途暂停（模拟进程重启）后从断点恢复
 *   3. 查看工作流的历史状态
 *   4. 多个 thread 并行执行
 */

import { END, START, Annotation, StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createLLM, printSection, printStep } from "./config.js";

// ============================================================
// 状态定义
// ============================================================

const PipelineState = Annotation.Root({
  topic: Annotation<string>(),
  phase: Annotation<"research" | "draft" | "review" | "done">(),
  research: Annotation<string>(),
  draft: Annotation<string>(),
  review: Annotation<string>(),
  steps: Annotation<Array<{ node: string; detail: string; time: string }>>(),
});

function addStep(steps: typeof PipelineState.State["steps"], node: string, detail: string) {
  return [...steps, { node, detail, time: new Date().toISOString() }];
}

// ============================================================
// 节点定义
// ============================================================

async function researchNode(state: typeof PipelineState.State) {
  printStep("act", "📚 调研...");
  const llm = createLLM();
  const prompt = ChatPromptTemplate.fromTemplate(
    "针对「{topic}」列出 3 个核心知识点，每个一行，控制在 80 字以内。"
  );
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const research = await chain.invoke({ topic: state.topic });
  printStep("result", `调研完成`);

  return {
    research,
    phase: "draft" as const,
    steps: addStep(state.steps, "research", "调研完成"),
  };
}

async function draftNode(state: typeof PipelineState.State) {
  printStep("act", "✍️ 撰写...");
  const llm = createLLM({ temperature: 0.6 });
  const prompt = ChatPromptTemplate.fromTemplate(
    `基于以下知识点撰写一段 150 字的短文，Markdown 格式。

主题：{topic}
知识点：
{research}`
  );
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const draft = await chain.invoke({ topic: state.topic, research: state.research });
  printStep("result", `撰写完成（${draft.length} 字）`);

  return {
    draft,
    phase: "review" as const,
    steps: addStep(state.steps, "draft", `撰写 ${draft.length} 字`),
  };
}

async function reviewNode(state: typeof PipelineState.State) {
  printStep("act", "🔍 审核...");
  const llm = createLLM({ temperature: 0 });
  const prompt = ChatPromptTemplate.fromTemplate(
    "为以下文章打分（1-10），一句话总结优缺点。\n\n{draft}"
  );
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const review = await chain.invoke({ draft: state.draft });
  printStep("result", `审核完成`);

  return {
    review,
    phase: "done" as const,
    steps: addStep(state.steps, "review", "审核完成"),
  };
}

// ============================================================
// 构建可持久化工作流
// ============================================================

function buildPersistentWorkflow(checkpointer: MemorySaver) {
  return new StateGraph(PipelineState)
    .addNode("research", researchNode)
    .addNode("draft", draftNode)
    .addNode("review", reviewNode)

    .addEdge(START, "research")
    .addEdge("research", "draft")
    .addEdge("draft", "review")
    .addEdge("review", END)

    // checkpointer 是持久化的关键参数
    // 每个节点执行完成后，状态自动保存到 checkpointer
    .compile({ checkpointer });
}

// ============================================================
// Demo 1: 基本的持久化与状态恢复
// ============================================================

async function demoPersistence() {
  printSection("Demo 1: 工作流持久化与状态查看");

  const checkpointer = new MemorySaver();
  const workflow = buildPersistentWorkflow(checkpointer);

  const threadId = "persist-demo-001";
  const config = { configurable: { thread_id: threadId } };

  // 运行完整工作流
  printStep("act", "运行完整工作流...");
  const result = await workflow.invoke(
    {
      topic: "什么是 LangGraph 的检查点机制",
      phase: "research" as const,
      research: "",
      draft: "",
      review: "",
      steps: [],
    },
    config
  );

  printStep("result", `工作流完成，共 ${result.steps.length} 步`);

  // 查看保存的状态（通过 getState 读取检查点）
  printStep("persist", "读取保存的检查点状态...");
  const savedState = await workflow.getState(config);

  printStep("result", `检查点状态:`);
  console.log(`  thread_id: ${threadId}`);
  console.log(`  phase: ${savedState.values.phase}`);
  console.log(`  steps: ${savedState.values.steps.length} 步`);
  console.log(`  draft 长度: ${savedState.values.draft.length} 字`);

  // 查看历史状态（getStateHistory 返回所有历史检查点）
  printStep("persist", "查看历史检查点...");
  const history = [];
  for await (const checkpoint of workflow.getStateHistory(config)) {
    history.push(checkpoint);
  }
  printStep("result", `共 ${history.length} 个历史检查点`);
  for (let i = 0; i < Math.min(history.length, 5); i++) {
    const cp = history[i]!;
    const phase = cp.values.phase || "init";
    const stepCount = cp.values.steps?.length ?? 0;
    console.log(`  [${i}] phase=${phase}, steps=${stepCount}`);
  }
}

// ============================================================
// Demo 2: 多 Thread 并行
// ============================================================

async function demoMultiThread() {
  printSection("Demo 2: 多 Thread 并行执行");

  const checkpointer = new MemorySaver();
  const workflow = buildPersistentWorkflow(checkpointer);

  const threads = [
    { id: "thread-react", topic: "React 19 新特性" },
    { id: "thread-vue", topic: "Vue 3.5 的改进" },
    { id: "thread-ts", topic: "TypeScript 5.6 类型体操" },
  ];

  // 并行启动多个工作流（不同 thread_id = 互不干扰的执行实例）
  printStep("act", `并行启动 ${threads.length} 个工作流...`);

  const results = await Promise.all(
    threads.map(({ id, topic }) =>
      workflow.invoke(
        {
          topic,
          phase: "research" as const,
          research: "",
          draft: "",
          review: "",
          steps: [],
        },
        { configurable: { thread_id: id } }
      ).then((result) => ({ id, topic, result }))
    )
  );

  // 对比各 thread 结果
  printStep("result", "\n📊 各 Thread 执行结果:");
  for (const { id, topic, result } of results) {
    console.log(`  [${id}] "${topic}"`);
    console.log(`    steps: ${result.steps.length}, draft: ${result.draft.length} 字`);
    console.log(`    审核: ${result.review.slice(0, 60)}...`);
  }

  // 验证 thread 隔离性
  printStep("persist", "\n验证 Thread 隔离性:");
  for (const { id, topic } of threads) {
    const state = await workflow.getState({ configurable: { thread_id: id } });
    const savedTopic = state.values.topic;
    const match = savedTopic === topic;
    printStep(
      match ? "result" : "error",
      `  [${id}] 存储的 topic=${savedTopic} ${match ? "✅" : "❌"}`
    );
  }
}

// ============================================================
// Demo 3: 模拟中断恢复（状态回溯）
// ============================================================

async function demoStateRewind() {
  printSection("Demo 3: 状态回溯（回到历史检查点）");

  const checkpointer = new MemorySaver();
  const workflow = buildPersistentWorkflow(checkpointer);

  const threadId = "rewind-demo";
  const config = { configurable: { thread_id: threadId } };

  // 执行完整工作流
  await workflow.invoke(
    {
      topic: "AI 工作流的设计模式",
      phase: "research" as const,
      research: "",
      draft: "",
      review: "",
      steps: [],
    },
    config
  );

  // 读取所有历史检查点
  const history = [];
  for await (const cp of workflow.getStateHistory(config)) {
    history.push(cp);
  }

  printStep("persist", `总共 ${history.length} 个检查点`);

  // 找到 "draft" 阶段的检查点（回溯到撰写完成时的状态）
  const draftCheckpoint = history.find(
    (cp) => cp.values.phase === "review" && cp.values.draft && !cp.values.review
  );

  if (draftCheckpoint) {
    printStep("result", `找到 draft 阶段的检查点:`);
    console.log(`  phase: ${draftCheckpoint.values.phase}`);
    console.log(`  draft: ${draftCheckpoint.values.draft.slice(0, 60)}...`);
    console.log(`  review: ${draftCheckpoint.values.review ? "有" : "无"}`);
    printStep("think", "在真实系统中，可以从这个检查点恢复执行（跳过调研，直接从撰写后继续）");
  } else {
    printStep("observe", "未找到精确的 draft 阶段检查点，展示最近的检查点:");
    for (const cp of history.slice(0, 3)) {
      console.log(`  phase=${cp.values.phase}, steps=${cp.values.steps?.length ?? 0}`);
    }
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("💾 Workflow 实战 Part 5: 持久化与恢复\n");
  console.log("MemorySaver 让工作流的状态可保存、可恢复、可回溯\n");

  await demoPersistence();
  await demoMultiThread();
  await demoStateRewind();
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
