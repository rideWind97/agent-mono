import { runSupervisorAgent } from "./lib/supervisor.js";

const task = process.argv.slice(2).join(" ");
const result = runSupervisorAgent(task || undefined);

console.log("=== Supervisor Multi-Agent Demo ===");
console.log(`任务：${result.task}`);

console.log("\n--- Plan ---");
for (const item of result.plan) {
  console.log(`- ${item.id}: ${item.assignee} -> ${item.instruction}`);
}

console.log("\n--- Trace ---");
for (const [index, step] of result.trace.entries()) {
  console.log(`${index + 1}. ${step.type.toUpperCase()}: ${step.content}`);
}

console.log("\n--- Final Answer ---");
console.log(result.answer);
