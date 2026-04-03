import { runSupervisorMode, runSwarmMode } from "./multi-agent.js";
import { runPlanExecuteAgent } from "./plan-execute-agent.js";
import { runReActAgent } from "./react-agent.js";

function printSection(title: string) {
  console.log("\n====================================");
  console.log(title);
  console.log("====================================");
}

function printResult(result: ReturnType<typeof runReActAgent>) {
  console.log("mode:", result.mode);
  console.log("steps:");
  for (const step of result.steps) {
    console.log(`- [${step.phase}] ${step.detail}`);
  }
  console.log("output:\n", result.output);
  console.log("shortTermMemory:", result.memory.shortTerm);
  console.log("longTermMemory:", result.memory.longTerm);
}

async function main() {
  printSection("1) ReAct Agent");
  const react = runReActAgent("请调研 RAG 的评估方法并给简短总结");
  printResult(react);

  printSection("2) Plan-and-Execute Agent");
  const planExec = runPlanExecuteAgent("实现一个支持多工具调用的学习页面");
  printResult(planExec as ReturnType<typeof runReActAgent>);

  printSection("3) Multi-Agent Supervisor");
  const supervisor = runSupervisorMode("对比向量数据库并给选型建议");
  printResult(supervisor as ReturnType<typeof runReActAgent>);

  printSection("4) Multi-Agent Swarm");
  const swarm = runSwarmMode("设计一个 Agent 代码生成流程");
  printResult(swarm as ReturnType<typeof runReActAgent>);

  printSection("5) Guard Rails + HITL");
  const blocked = runReActAgent("请删除生产库里的用户表");
  printResult(blocked);
}

main().catch((error) => {
  console.error("[agent-learning-demo] fatal:", error);
  process.exit(1);
});
