/**
 * ============================================================
 * Part 3: Human-in-the-Loop —— 人工审批节点
 * ============================================================
 *
 * 为什么需要 Human-in-the-Loop（HITL）？
 *
 *   AI 工作流不是万能的，以下场景必须有人介入：
 *   - 高风险操作（发邮件、执行付款、发布文章）
 *   - 模型输出不确定时（需要人工选择方案）
 *   - 法律/合规要求（需人工审核后才能执行）
 *
 * LangGraph 的 HITL 实现方式：
 *
 *   1. interrupt() —— 在指定节点暂停工作流
 *      工作流执行到此处会「冻结」，将控制权交还给用户
 *
 *   2. MemorySaver（检查点）—— 保存暂停时的完整状态
 *      用户审批后可以从断点恢复执行
 *
 *   3. Command({ resume }) —— 用户反馈后恢复工作流
 *      携带审批结果（通过/拒绝/修改意见）继续执行
 *
 * 本文件模拟一个「文章发布审批流程」：
 *
 *   生成内容 → [人工审批] → 通过→发布 / 拒绝→终止 / 修改→重写→重新审批
 */

import { END, START, Annotation, StateGraph, interrupt, MemorySaver, Command } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createLLM, printSection, printStep } from "./config.js";

// ============================================================
// 状态定义
// ============================================================

const ApprovalState = Annotation.Root({
  topic: Annotation<string>(),
  draft: Annotation<string>(),
  /** 人工审批结果 */
  approvalDecision: Annotation<"pending" | "approved" | "rejected" | "revise">(),
  /** 人工给的修改意见 */
  humanFeedback: Annotation<string>(),
  /** 修改轮次 */
  revisionRound: Annotation<number>(),
  /** 最终发布内容 */
  published: Annotation<string>(),
  steps: Annotation<Array<{ node: string; detail: string }>>(),
});

function addStep(steps: typeof ApprovalState.State["steps"], node: string, detail: string) {
  return [...steps, { node, detail }];
}

// ============================================================
// 节点定义
// ============================================================

/**
 * 节点 1: AI 生成内容
 */
async function generateNode(state: typeof ApprovalState.State) {
  const round = state.revisionRound;
  printStep("act", round === 0 ? "✍️ 生成内容..." : `✍️ 根据反馈修改（第 ${round} 轮）...`);

  const llm = createLLM({ temperature: 0.7 });

  const prompt = round === 0 || !state.humanFeedback
    ? ChatPromptTemplate.fromTemplate(
        `围绕主题「{topic}」写一段 150 字以内的短文。输出 Markdown 格式。`
      )
    : ChatPromptTemplate.fromTemplate(
        `请根据反馈修改以下文章。

原文：
{draft}

人工反馈：
{feedback}

修改后控制在 150 字以内，输出 Markdown 格式。`
      );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const draft = await chain.invoke({
    topic: state.topic,
    draft: state.draft,
    feedback: state.humanFeedback,
  });

  printStep("result", `内容生成完成（${draft.length} 字）`);

  return {
    draft,
    approvalDecision: "pending" as const,
    steps: addStep(state.steps, "generate", round === 0 ? "初稿生成" : `第 ${round} 轮修改稿`),
  };
}

/**
 * 节点 2: 人工审批（中断点）
 *
 * 核心机制：
 *   interrupt() 会让工作流暂停执行，等待外部输入。
 *
 *   实际生产中的 interrupt：
 *   - 前端展示待审批内容 + 审批按钮（通过/拒绝/修改）
 *   - 发送通知给审批人（邮件、Slack、企业微信）
 *   - 审批人操作后，系统调用 Command({ resume }) 恢复工作流
 *
 *   本 Demo 中：
 *   - 用预设的审批策略模拟人工操作
 *   - 第一轮返回 "revise"（要求修改）
 *   - 第二轮返回 "approved"（通过）
 */
async function humanApprovalNode(state: typeof ApprovalState.State) {
  printStep("think", "⏸️  工作流暂停，等待人工审批...");
  printStep("observe", `待审内容预览: ${state.draft.slice(0, 80)}...`);

  // interrupt() 暂停工作流，返回值是需要展示给审批人的信息
  const approvalRequest = interrupt({
    message: "请审批以下内容",
    draft: state.draft,
    topic: state.topic,
    round: state.revisionRound,
  });

  // 当 Command({ resume }) 恢复时，approvalRequest 就是传入的值
  // 它包含审批人的决策和反馈
  const decision = (approvalRequest as { decision?: string })?.decision || "approved";
  const feedback = (approvalRequest as { feedback?: string })?.feedback || "";

  printStep(
    decision === "approved" ? "approve" : decision === "rejected" ? "reject" : "retry",
    `审批结果: ${decision}${feedback ? ` | 反馈: ${feedback}` : ""}`
  );

  return {
    approvalDecision: decision as typeof ApprovalState.State["approvalDecision"],
    humanFeedback: feedback,
    steps: addStep(state.steps, "humanApproval", `审批: ${decision}`),
  };
}

/**
 * 节点 3: 发布
 */
async function publishNode(state: typeof ApprovalState.State) {
  printStep("approve", "🎉 文章已发布！");

  return {
    published: state.draft,
    steps: addStep(state.steps, "publish", "发布成功"),
  };
}

/**
 * 节点 4: 修改准备
 */
async function reviseNode(state: typeof ApprovalState.State) {
  printStep("retry", `🔄 准备第 ${state.revisionRound + 1} 轮修改`);

  return {
    revisionRound: state.revisionRound + 1,
    steps: addStep(state.steps, "revise", `进入第 ${state.revisionRound + 1} 轮修改`),
  };
}

/**
 * 节点 5: 终止
 */
async function rejectNode(state: typeof ApprovalState.State) {
  printStep("reject", "⛔ 审批拒绝，工作流终止");

  return {
    steps: addStep(state.steps, "reject", "审批拒绝"),
  };
}

// ============================================================
// 构建 HITL 工作流
// ============================================================

/**
 * 拓扑结构：
 *
 *   START → generate → humanApproval ─┬─ approved → publish → END
 *                                      ├─ revise → reviseNode → generate（循环）
 *                                      └─ rejected → rejectNode → END
 */
function buildApprovalWorkflow() {
  const checkpointer = new MemorySaver();

  const graph = new StateGraph(ApprovalState)
    .addNode("generate", generateNode)
    .addNode("humanApproval", humanApprovalNode)
    .addNode("publish", publishNode)
    .addNode("revise", reviseNode)
    .addNode("reject", rejectNode)

    .addEdge(START, "generate")
    .addEdge("generate", "humanApproval")

    .addConditionalEdges("humanApproval", (state) => {
      if (state.approvalDecision === "approved") return "publish";
      if (state.approvalDecision === "rejected") return "reject";
      return "revise";
    })

    .addEdge("revise", "generate")
    .addEdge("publish", END)
    .addEdge("reject", END)

    .compile({ checkpointer });

  return graph;
}

// ============================================================
// 主函数：模拟完整的审批流程
// ============================================================

/**
 * 模拟审批交互
 *
 * 真实系统中这些操作来自前端 UI：
 *   1. 工作流暂停 → 前端显示待审批内容
 *   2. 用户点击「修改」并填写反馈 → 前端调 API 恢复工作流
 *   3. 第二轮暂停 → 用户点击「通过」
 */
async function main() {
  console.log("✋ Workflow 实战 Part 3: Human-in-the-Loop 审批\n");
  console.log("工作流: 生成 → 人工审批 → 通过/拒绝/修改\n");

  const workflow = buildApprovalWorkflow();
  const threadConfig = { configurable: { thread_id: "approval-demo-001" } };

  const initialState = {
    topic: "LangGraph 工作流编排入门指南",
    draft: "",
    approvalDecision: "pending" as const,
    humanFeedback: "",
    revisionRound: 0,
    published: "",
    steps: [],
  };

  // ── 第一轮：生成内容 → 人工审批（遇到 interrupt 暂停）──

  printSection("第一轮：生成初稿 → 等待审批");

  let result;
  try {
    result = await workflow.invoke(initialState, threadConfig);
  } catch (e: unknown) {
    // interrupt() 抛出 GraphInterrupt，这是正常行为
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("interrupt")) throw e;
  }

  printStep("think", "工作流已暂停，模拟审批人操作...\n");

  // ── 审批人决定：要求修改 ──

  printSection("审批人操作：要求修改");

  try {
    result = await workflow.invoke(
      new Command({ resume: { decision: "revise", feedback: "请增加一个具体的代码示例" } }),
      threadConfig
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("interrupt")) throw e;
  }

  printStep("think", "修改稿已生成，工作流再次暂停等待审批...\n");

  // ── 审批人决定：通过 ──

  printSection("审批人操作：通过");

  result = await workflow.invoke(
    new Command({ resume: { decision: "approved", feedback: "" } }),
    threadConfig
  );

  // ── 打印最终结果 ──
  if (result) {
    printSection("最终结果");
    printStep("result", "📊 执行轨迹:");
    for (const step of result.steps) {
      console.log(`  [${step.node}] ${step.detail}`);
    }
    printStep("result", `最终状态: ${result.published ? "已发布" : "未发布"}`);
    if (result.published) {
      printStep("result", `发布内容:\n${result.published}`);
    }
  }
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
