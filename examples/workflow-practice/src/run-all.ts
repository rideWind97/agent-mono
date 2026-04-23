/**
 * ============================================================
 * 统一运行器 —— 一键运行所有 Workflow 实战 Demo
 * ============================================================
 *
 * 使用方式：
 *   cd examples/workflow-practice
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
    title: "内容创作工作流",
    file: "01-content-creation-workflow.ts",
    description: "DAG 有向无环图 —— 调研→大纲→撰写→审核",
  },
  {
    id: 2,
    title: "条件分支与循环",
    file: "02-conditional-branch-loop.ts",
    description: "评分路由 + 自动改稿循环",
  },
  {
    id: 3,
    title: "Human-in-the-Loop",
    file: "03-human-in-the-loop.ts",
    description: "interrupt 暂停 + 人工审批 + 恢复",
  },
  {
    id: 4,
    title: "错误处理与重试",
    file: "04-error-handling-retry.ts",
    description: "指数退避重试 + 模型降级 + 结果验证",
  },
  {
    id: 5,
    title: "持久化与恢复",
    file: "05-persistence-recovery.ts",
    description: "MemorySaver 检查点 + 多 Thread + 状态回溯",
  },
];

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ⚙️  Workflow 工作流 —— 完整实战项目                ║
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
  console.log("📚 详细学习文档请查看: WORKFLOW_PRACTICE_GUIDE.md\n");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
