import type { WorkflowRunResult } from "./lib/types.js";

export function printResult(title: string, result: WorkflowRunResult) {
  console.log(`\n=== ${title} ===`);
  console.log(result.message);
  console.log(`threadId: ${result.state.threadId}`);
  console.log(`status: ${result.state.status}`);
  console.log(`nextNode: ${result.state.nextNode}`);

  console.log("\n--- Steps ---");
  for (const [index, step] of result.state.steps.entries()) {
    console.log(`${index + 1}. ${step.node}: ${step.detail}`);
  }

  if (result.state.draft) {
    console.log("\n--- Draft ---");
    console.log(result.state.draft);
  }
}
