import { findLatestCheckpoint } from "./lib/checkpoint-store.js";
import { resumeContentWorkflow } from "./lib/content-workflow.js";
import { printResult } from "./print.js";

const [, , threadIdArg, decisionArg, ...feedbackParts] = process.argv;
const latestThreadId = await findLatestCheckpoint();
const threadId = threadIdArg && !["approve", "reject"].includes(threadIdArg) ? threadIdArg : latestThreadId;
const decision = threadIdArg === "approve" || threadIdArg === "reject" ? threadIdArg : decisionArg;
const feedback = feedbackParts.join(" ") || "人工审批完成";

if (!threadId) {
  throw new Error("没有找到可 resume 的 checkpoint，请先运行 start。");
}

if (decision !== "approve" && decision !== "reject") {
  throw new Error("请传入 approve 或 reject，例如：resume <threadId> approve \"内容可以发布\"");
}

const result = await resumeContentWorkflow(threadId, {
  approved: decision === "approve",
  feedback,
});

printResult("Resume Content Workflow", result);
