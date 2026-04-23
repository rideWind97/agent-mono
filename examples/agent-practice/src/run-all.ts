/**
 * ============================================================
 * 统一运行器 —— 一键运行所有 Agent 实战 Demo
 * ============================================================
 *
 * 使用方式：
 *   cd examples/agent-practice
 *   pnpm install
 *   npx tsx src/run-all.ts           # 运行全部
 *   npx tsx src/run-all.ts 1         # 只运行 Part 1
 *   npx tsx src/run-all.ts 1 3       # 运行 Part 1 和 Part 3
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Demo {
  id: number;
  title: string;
  file: string;
  description: string;
}

const demos: Demo[] = [
  {
    id: 1,
    title: "ReAct Agent",
    file: "01-react-agent.ts",
    description: "推理与行动循环 —— Agent 的核心模式",
  },
  {
    id: 2,
    title: "多工具 Agent",
    file: "02-multi-tools-agent.ts",
    description: "5 种工具的智能选择与编排",
  },
  {
    id: 3,
    title: "Supervisor 多 Agent",
    file: "03-supervisor-multi-agent.ts",
    description: "多专家协作完成复杂任务",
  },
  {
    id: 4,
    title: "Agent 记忆系统",
    file: "04-memory-agent.ts",
    description: "短期记忆 + 长期记忆 + 摘要压缩",
  },
  {
    id: 5,
    title: "安全护栏 + HITL",
    file: "05-guardrails-agent.ts",
    description: "Guard Rails、Prompt 注入防御、人工介入",
  },
];

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🤖  Agent 智能体 —— 完整实战项目                   ║
║                                                      ║
║   基于 LangGraph + LangChain + TypeScript             ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`);

  console.log("📋 可用的 Demo:\n");
  for (const demo of demos) {
    console.log(`  [${demo.id}] ${demo.title} — ${demo.description}`);
  }
  console.log();
}

function runDemo(demo: Demo) {
  const line = "━".repeat(60);
  console.log(`\n${line}`);
  console.log(`  🚀 Running Part ${demo.id}: ${demo.title}`);
  console.log(`  📄 ${demo.file}`);
  console.log(`  📝 ${demo.description}`);
  console.log(`${line}\n`);

  const filePath = resolve(__dirname, demo.file);

  try {
    execSync(`npx tsx "${filePath}"`, {
      stdio: "inherit",
      cwd: resolve(__dirname, ".."),
      env: { ...process.env },
    });
    console.log(`\n✅ Part ${demo.id} 完成\n`);
  } catch {
    console.error(`\n❌ Part ${demo.id} 执行失败\n`);
  }
}

async function main() {
  printBanner();

  const args = process.argv.slice(2);

  // 如果指定了参数，只运行指定的 demo
  const selectedIds = args
    .map((a) => parseInt(a, 10))
    .filter((n) => !isNaN(n));

  const toRun = selectedIds.length > 0
    ? demos.filter((d) => selectedIds.includes(d.id))
    : demos;

  if (toRun.length === 0) {
    console.log("❌ 未找到匹配的 Demo，可用 ID: 1-5");
    process.exit(1);
  }

  console.log(`📦 将运行 ${toRun.length} 个 Demo: ${toRun.map((d) => d.title).join(", ")}\n`);

  for (const demo of toRun) {
    runDemo(demo);
  }

  console.log("\n🎉 全部 Demo 运行完成！");
  console.log("📚 详细学习文档请查看: AGENT_PRACTICE_GUIDE.md\n");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
