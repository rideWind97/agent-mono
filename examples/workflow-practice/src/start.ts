import { startContentWorkflow } from "./lib/content-workflow.js";
import { printResult } from "./print.js";

const topic = process.argv.slice(2).join(" ") || "Workflow 和 Agent 的区别";

const result = await startContentWorkflow({ topic });
printResult("Start Content Workflow", result);

if (result.interrupted) {
  console.log("\n下一步：");
  console.log(`pnpm --filter @agent-mono/workflow-practice resume ${result.state.threadId} approve "内容可以发布"`);
}
