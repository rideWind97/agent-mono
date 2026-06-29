/**
 * 统一运行器
 *
 * 使用：
 *   npx tsx src/run-all.ts           # 运行全部
 *   npx tsx src/run-all.ts 1         # 只运行 Part 1
 *   npx tsx src/run-all.ts 1 4       # 运行 Part 1 和 Part 4
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
    title: "数据集准备",
    file: "01-dataset-preparation.ts",
    description: "JSONL 格式、数据清洗、质量验证、训练/验证集拆分",
  },
  {
    id: 2,
    title: "Fine-tuning API",
    file: "02-finetune-api.ts",
    description: "上传数据 → 创建任务 → 轮询状态 → 使用模型（DRY RUN）",
  },
  {
    id: 3,
    title: "效果评估",
    file: "03-evaluation.ts",
    description: "基线对比、格式遵循度、类别/严重度准确率、A/B 对比",
  },
  {
    id: 4,
    title: "成本与收益分析",
    file: "04-cost-analysis.ts",
    description: "Prompt vs Fine-tuning 成本对比、决策树",
  },
];

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🔧  Fine-tuning 微调 —— 完整实战项目               ║
║                                                      ║
║   基于 OpenAI API + TypeScript                        ║
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

  try {
    execSync(`npx tsx "${resolve(__dirname, demo.file)}"`, {
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
  const selectedIds = args.map((a) => parseInt(a, 10)).filter((n) => !isNaN(n));
  const toRun = selectedIds.length > 0 ? demos.filter((d) => selectedIds.includes(d.id)) : demos;

  if (toRun.length === 0) {
    console.log("❌ 未找到匹配的 Demo，可用 ID: 1-4");
    process.exit(1);
  }

  console.log(`📦 将运行 ${toRun.length} 个 Demo: ${toRun.map((d) => d.title).join(", ")}\n`);
  for (const demo of toRun) runDemo(demo);

  console.log("\n🎉 全部 Demo 运行完成！");
  console.log("📚 详细学习文档请查看: FINETUNING_PRACTICE_GUIDE.md\n");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
