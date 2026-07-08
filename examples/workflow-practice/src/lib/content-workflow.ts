import { deleteCheckpoint, loadCheckpoint, saveCheckpoint } from "./checkpoint-store.js";
import type {
  ContentWorkflowState,
  HumanReview,
  ResumeInput,
  WorkflowNode,
  WorkflowRunResult,
} from "./types.js";

function createThreadId() {
  return `content-${Date.now()}`;
}

function addStep(state: ContentWorkflowState, node: WorkflowNode, detail: string) {
  state.steps.push({ node, detail });
}

function createInitialState(input: {
  topic: string;
  audience?: string;
  threadId?: string;
}): ContentWorkflowState {
  return {
    threadId: input.threadId ?? createThreadId(),
    topic: input.topic,
    audience: input.audience ?? "Agent 初学者",
    revisionCount: 0,
    nextNode: "brief",
    status: "running",
    steps: [],
  };
}

function briefNode(state: ContentWorkflowState) {
  state.brief = `为「${state.audience}」写一篇关于「${state.topic}」的学习短文。`;
  state.nextNode = "research";
  addStep(state, "brief", `生成内容 brief：${state.brief}`);
}

function researchNode(state: ContentWorkflowState) {
  state.researchNotes = [
    "Workflow 适合步骤固定、可审计、可恢复的业务流程。",
    "DAG 通过节点和边表达执行顺序，条件边可以根据状态选择分支。",
    "HITL 会在关键节点中断，等待人类审批后再 resume。",
  ];
  state.nextNode = "draft";
  addStep(state, "research", "完成资料收集，得到 3 条研究笔记。");
}

function draftNode(state: ContentWorkflowState) {
  const notes = state.researchNotes ?? [];
  state.draft = [
    `# ${state.topic}`,
    "",
    `面向读者：${state.audience}`,
    "",
    "核心要点：",
    ...notes.map((note) => `- ${note}`),
  ].join("\n");
  state.nextNode = "qualityReview";
  addStep(state, "draft", "基于 brief 和研究笔记生成初稿。");
}

function qualityReviewNode(state: ContentWorkflowState) {
  // 这里用确定性规则模拟质量评分。
  // 第一版故意给低分，让工作流走一次 revise 循环，便于观察“条件边 + 循环边”。
  const baseScore = state.revisionCount === 0 ? 72 : 91;
  state.qualityScore = baseScore;
  state.nextNode = baseScore >= 85 ? "humanApproval" : "revise";
  addStep(
    state,
    "qualityReview",
    `质量评分 ${baseScore}，${baseScore >= 85 ? "进入人工审批" : "需要修改后重新评审"}`,
  );
}

function reviseNode(state: ContentWorkflowState) {
  state.revisionCount += 1;
  state.draft = [
    state.draft ?? "",
    "",
    "补充说明：",
    "- 本文加入了 HITL resume 的说明，强调中断后状态会从 checkpoint 恢复。",
    "- 本文加入了 Workflow vs Agent 的选型原则。",
  ].join("\n");
  state.nextNode = "qualityReview";
  addStep(state, "revise", `第 ${state.revisionCount} 次修改完成，回到质量评审节点。`);
}

function humanApprovalNode(state: ContentWorkflowState) {
  // HITL 节点不会自动继续。
  // 它保存 checkpoint，然后把状态标记成 interrupted，等待用户通过 resume 提供审批结果。
  state.status = "interrupted";
  state.nextNode = "humanApproval";
  addStep(state, "humanApproval", "等待人工审批：approve 或 reject。");
}

function applyHumanReview(state: ContentWorkflowState, review: HumanReview) {
  state.humanReview = review;
  state.status = "running";
  state.nextNode = review.approved ? "publish" : "revise";
  addStep(
    state,
    "humanApproval",
    review.approved ? `人工审批通过：${review.feedback}` : `人工审批拒绝：${review.feedback}`,
  );
}

function publishNode(state: ContentWorkflowState) {
  state.publishedUrl = `local://content/${state.threadId}`;
  state.status = "completed";
  state.nextNode = "end";
  addStep(state, "publish", `发布完成：${state.publishedUrl}`);
}

async function runUntilStop(state: ContentWorkflowState): Promise<WorkflowRunResult> {
  while (state.status === "running" && state.nextNode !== "end") {
    switch (state.nextNode) {
      case "brief":
        briefNode(state);
        break;
      case "research":
        researchNode(state);
        break;
      case "draft":
        draftNode(state);
        break;
      case "qualityReview":
        qualityReviewNode(state);
        break;
      case "revise":
        reviseNode(state);
        break;
      case "humanApproval":
        humanApprovalNode(state);
        break;
      case "publish":
        publishNode(state);
        break;
    }

    await saveCheckpoint(state);
  }

  if (state.status === "completed") {
    await deleteCheckpoint(state.threadId);
  }

  return {
    state,
    interrupted: state.status === "interrupted",
    message:
      state.status === "interrupted"
        ? `工作流已在 humanApproval 中断，请使用 threadId=${state.threadId} resume。`
        : `工作流完成，发布地址：${state.publishedUrl}`,
  };
}

export async function startContentWorkflow(input: {
  topic: string;
  audience?: string;
  threadId?: string;
}) {
  const state = createInitialState(input);
  return runUntilStop(state);
}

export async function resumeContentWorkflow(threadId: string, input: ResumeInput) {
  const state = await loadCheckpoint(threadId);

  if (state.status !== "interrupted" || state.nextNode !== "humanApproval") {
    throw new Error(`threadId=${threadId} 当前不在 humanApproval 中断状态`);
  }

  applyHumanReview(state, input);
  await saveCheckpoint(state);

  return runUntilStop(state);
}
