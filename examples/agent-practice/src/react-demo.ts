import { runReactWeatherAgent } from "./lib/react-agent.js";

const task = process.argv.slice(2).join(" ");
const result = runReactWeatherAgent(task || undefined);

console.log("=== ReAct Agent Demo ===");
console.log(`任务：${result.task}`);

console.log("\n--- Trace ---");
for (const [index, step] of result.trace.entries()) {
  console.log(`${index + 1}. ${step.type.toUpperCase()}: ${step.content}`);
}

console.log("\n--- Final Answer ---");
console.log(result.answer);
