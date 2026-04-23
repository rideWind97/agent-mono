/**
 * ============================================================
 * Part 2: 条件分支与循环 —— 让工作流具备「判断力」
 * ============================================================
 *
 * Part 1 的 DAG 是纯线性的（A→B→C→D），现实中大多数工作流
 * 需要根据中间结果做出不同的决策：
 *
 * 条件分支（Conditional Edge）：
 *   - "如果文章质量高 → 直接发布；质量低 → 返回修改"
 *   - 用 addConditionalEdges() 实现
 *   - 路由函数接收当前 state，返回下一个节点的名称
 *
 * 循环（Loop）：
 *   - "审核不通过 → 修改 → 再审核 → 通过 → 发布"
 *   - 在 LangGraph 中用条件边指向之前的节点来实现
 *   - 必须设置最大循环次数，防止死循环
 *
 * 本文件实现一个「自动改稿工作流」：
 *
 *   撰写 → 评分 ─┬─ ≥7 分 → 发布
 *                 └─ <7 分 → 修改 → 评分（循环，最多 3 次）
 */

import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createLLM, printSection, printStep } from "./config.js";

// ============================================================
// 状态定义
// ============================================================

const RevisionState = Annotation.Root({
  topic: Annotation<string>(),
  /** 当前稿件内容 */
  draft: Annotation<string>(),
  /** 评分（1-10） */
  score: Annotation<number>(),
  /** 评审意见 */
  feedback: Annotation<string>(),
  /** 已修改次数（用于限制循环次数） */
  revisionCount: Annotation<number>(),
  /** 最大允许修改次数 */
  maxRevisions: Annotation<number>(),
  /** 最终状态：published / max_revisions_reached */
  status: Annotation<string>(),
  /** 执行轨迹 */
  steps: Annotation<Array<{ node: string; detail: string }>>(),
});

function addStep(steps: typeof RevisionState.State["steps"], node: string, detail: string) {
  return [...steps, { node, detail }];
}

// ============================================================
// 节点定义
// ============================================================

/**
 * 节点 1: 撰写初稿
 */
async function writeNode(state: typeof RevisionState.State) {
  printStep("act", `✍️ 撰写节点（第 ${state.revisionCount + 1} 版）...`);

  const llm = createLLM({ temperature: 0.7 });

  // 如果有之前的反馈，说明是修改稿，需要根据反馈改进
  const isRevision = state.revisionCount > 0 && state.feedback;

  const prompt = isRevision
    ? ChatPromptTemplate.fromTemplate(
        `你是一个技术写作专家。请根据审核反馈修改以下文章。

原文：
{draft}

审核反馈：
{feedback}

要求：
1. 针对反馈中指出的问题逐一修改
2. 保持原文的优点不变
3. 控制在 300 字以内
4. 输出完整的修改后文章（Markdown）`
      )
    : ChatPromptTemplate.fromTemplate(
        `你是一个技术写作专家。请围绕主题「{topic}」撰写一篇短文。

要求：
1. 包含 2-3 个核心要点
2. 使用通俗易懂的语言
3. 控制在 300 字以内
4. 输出 Markdown 格式`
      );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const draft = await chain.invoke({
    topic: state.topic,
    draft: state.draft,
    feedback: state.feedback,
  });

  const label = isRevision ? `修改第 ${state.revisionCount + 1} 版` : "撰写初稿";
  printStep("result", `${label}完成（${draft.length} 字）`);

  return {
    draft,
    steps: addStep(state.steps, "write", `${label}，${draft.length} 字`),
  };
}

/**
 * 节点 2: 评分审核
 *
 * 这个节点的输出（score）将决定条件分支的走向：
 *   score >= 7 → 发布
 *   score < 7  → 返回修改（如果未超过最大次数）
 */
async function scoreNode(state: typeof RevisionState.State) {
  printStep("act", "🔍 评分节点：审核文章质量...");

  const llm = createLLM({ temperature: 0 });
  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个严格的内容审核编辑。请为以下文章评分并给出反馈。

主题：{topic}
文章：
{draft}

请输出以下格式（严格遵守）：
SCORE: [1-10的整数]
FEEDBACK: [具体修改建议，50字以内]`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const result = await chain.invoke({ topic: state.topic, draft: state.draft });

  // 从 LLM 输出中解析评分
  const scoreMatch = result.match(/SCORE:\s*(\d+)/);
  const feedbackMatch = result.match(/FEEDBACK:\s*(.+)/s);

  const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]!, 10))) : 5;
  const feedback = feedbackMatch?.[1]?.trim() || "无具体反馈";

  const emoji = score >= 7 ? "✅" : "⚠️";
  printStep("result", `${emoji} 评分: ${score}/10 | 反馈: ${feedback.slice(0, 60)}`);

  return {
    score,
    feedback,
    steps: addStep(state.steps, "score", `评分 ${score}/10`),
  };
}

/**
 * 节点 3: 发布（终态节点）
 */
async function publishNode(state: typeof RevisionState.State) {
  printStep("approve", `🎉 发布节点：文章通过审核，评分 ${state.score}/10`);

  return {
    status: "published",
    steps: addStep(state.steps, "publish", `发布成功，最终评分 ${state.score}/10`),
  };
}

/**
 * 节点 4: 修改准备
 *
 * 仅更新 revisionCount，实际修改在 writeNode 中完成。
 * 拆分出来是因为 LangGraph 的条件边需要指向一个明确的节点。
 */
async function prepareRevisionNode(state: typeof RevisionState.State) {
  const newCount = state.revisionCount + 1;
  printStep("retry", `🔄 第 ${newCount} 次修改（最多 ${state.maxRevisions} 次）`);

  return {
    revisionCount: newCount,
    steps: addStep(state.steps, "prepareRevision", `进入第 ${newCount} 次修改`),
  };
}

/**
 * 节点 5: 超限终止
 */
async function maxRevisionsNode(state: typeof RevisionState.State) {
  printStep("error", `⛔ 已达最大修改次数（${state.maxRevisions}），强制结束`);

  return {
    status: "max_revisions_reached",
    steps: addStep(state.steps, "maxRevisions", `达到上限 ${state.maxRevisions} 次，强制结束`),
  };
}

// ============================================================
// 构建带条件分支和循环的工作流
// ============================================================

/**
 * 工作流拓扑（含条件分支和循环）：
 *
 *   START → write → score ─┬─ score >= 7 ─────────→ publish → END
 *                           │
 *                           └─ score < 7 且未超限 → prepareRevision → write（循环）
 *                           │
 *                           └─ score < 7 但超限 ──→ maxRevisions → END
 *
 * 关键点：
 *   - score 节点后的 addConditionalEdges 实现了三路分支
 *   - prepareRevision → write 形成循环
 *   - maxRevisions 的 revisionCount 限制防止死循环
 */
function buildRevisionWorkflow() {
  return new StateGraph(RevisionState)
    .addNode("write", writeNode)
    .addNode("score", scoreNode)
    .addNode("publish", publishNode)
    .addNode("prepareRevision", prepareRevisionNode)
    .addNode("maxRevisions", maxRevisionsNode)

    .addEdge(START, "write")
    .addEdge("write", "score")

    // 条件分支：评分后的三路路由
    .addConditionalEdges("score", (state) => {
      // 路由函数返回下一个节点的名称
      if (state.score >= 7) return "publish";
      if (state.revisionCount >= state.maxRevisions) return "maxRevisions";
      return "prepareRevision";
    })

    // 循环：修改后重新撰写
    .addEdge("prepareRevision", "write")

    // 两个终态都指向 END
    .addEdge("publish", END)
    .addEdge("maxRevisions", END)

    .compile();
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("🔀 Workflow 实战 Part 2: 条件分支与循环\n");
  console.log("工作流: 撰写 → 评分 → 通过则发布 / 不通过则修改（最多 3 次）\n");

  const testCases = [
    { topic: "为什么前端开发者应该学习 AI", maxRevisions: 3 },
    { topic: "用 3 句话解释量子计算", maxRevisions: 2 },
  ];

  for (const { topic, maxRevisions } of testCases) {
    printSection(`主题: "${topic}"（最多 ${maxRevisions} 次修改）`);

    const workflow = buildRevisionWorkflow();
    const result = await workflow.invoke({
      topic,
      draft: "",
      score: 0,
      feedback: "",
      revisionCount: 0,
      maxRevisions,
      status: "",
      steps: [],
    });

    printStep("result", "\n📊 执行轨迹:");
    for (const step of result.steps) {
      console.log(`  [${step.node}] ${step.detail}`);
    }
    printStep("result", `最终状态: ${result.status} | 评分: ${result.score}/10 | 修改次数: ${result.revisionCount}`);
    console.log("\n" + "─".repeat(60));
  }
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
