import { startContentWorkflow, resumeContentWorkflow } from "./lib/content-workflow.js";
import { printResult } from "./print.js";

const threadId = "demo-content-workflow";

const interrupted = await startContentWorkflow({
  threadId,
  topic: "Workflow 和 Agent 的区别",
  audience: "Agent 初学者",
});

printResult("Demo Step 1: interrupted at HITL", interrupted);

const completed = await resumeContentWorkflow(threadId, {
  approved: true,
  feedback: "内容结构清晰，可以发布。",
});

printResult("Demo Step 2: resumed and completed", completed);
