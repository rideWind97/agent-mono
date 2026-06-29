/**
 * ============================================================
 * Part 2: OpenAI Fine-tuning API —— 完整微调流程
 * ============================================================
 *
 * OpenAI Fine-tuning 的完整生命周期：
 *
 *   1. 上传数据文件 → files.create()
 *   2. 创建微调任务 → fineTuning.jobs.create()
 *   3. 轮询任务状态 → fineTuning.jobs.retrieve()
 *   4. 查看训练指标 → fineTuning.jobs.listEvents()
 *   5. 使用微调模型 → chat.completions.create({ model: "ft:..." })
 *
 * 关键参数：
 *   - model: 基座模型（gpt-4o-mini-2024-07-18 推荐入门）
 *   - n_epochs: 训练轮数（通常 3-5，数据少时可增大）
 *   - learning_rate_multiplier: 学习率系数（默认自动）
 *   - batch_size: 批大小（默认自动）
 *
 * 注意：实际微调需要花费真金白银（$$$）且耗时 10-60 分钟。
 * 本文件提供完整可运行代码，但默认以 DRY RUN 模式运行（不实际提交）。
 * 设置环境变量 ACTUALLY_RUN_FINETUNE=true 才会执行真实微调。
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, config, printSection, printStep } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "data");
const TRAIN_FILE = resolve(DATA_DIR, "train.jsonl");

const DRY_RUN = process.env.ACTUALLY_RUN_FINETUNE !== "true";

// ============================================================
// 步骤 1: 上传训练数据
// ============================================================

/**
 * 上传 JSONL 文件到 OpenAI
 *
 * API: POST /v1/files
 * purpose: "fine-tune" 表示用于微调
 *
 * 上传后会得到一个 file_id（如 "file-abc123"），后续创建微调任务时需要用到。
 * 上传的文件会经过 OpenAI 的格式验证，不符合要求会报错。
 */
async function uploadTrainingFile(): Promise<string | null> {
  printSection("步骤 1: 上传训练数据");

  if (!existsSync(TRAIN_FILE)) {
    printStep("error", `训练文件不存在: ${TRAIN_FILE}`);
    printStep("think", "请先运行 Part 1 生成数据集: npx tsx src/01-dataset-preparation.ts");
    return null;
  }

  const fileContent = readFileSync(TRAIN_FILE, "utf-8");
  const lineCount = fileContent.trim().split("\n").length;
  printStep("data", `训练文件: ${TRAIN_FILE} (${lineCount} 条样本)`);

  if (DRY_RUN) {
    printStep("think", "[DRY RUN] 跳过实际上传");
    printStep("think", "设置 ACTUALLY_RUN_FINETUNE=true 环境变量以执行真实微调");
    return "file-dry-run-placeholder";
  }

  const client = createClient();

  // OpenAI SDK 的 files.create 接受 File 对象或 Uploadable
  const file = await client.files.create({
    file: new File([fileContent], "train.jsonl", { type: "application/jsonl" }),
    purpose: "fine-tune",
  });

  printStep("result", `✅ 文件上传成功: ${file.id}`);
  printStep("data", `  状态: ${file.status} | 大小: ${file.bytes} bytes`);

  return file.id;
}

// ============================================================
// 步骤 2: 创建微调任务
// ============================================================

/**
 * 创建微调任务
 *
 * API: POST /v1/fine_tuning/jobs
 *
 * 核心参数解释：
 *   - training_file: 上传的训练数据 file_id
 *   - model: 基座模型（微调是在已有模型基础上继续训练）
 *   - hyperparameters.n_epochs: 训练轮数
 *     - 数据少（<100条）: 用 5-10 epochs
 *     - 数据多（>1000条）: 用 2-3 epochs
 *   - suffix: 模型名后缀（方便识别，如 "code-reviewer"）
 */
async function createFineTuningJob(fileId: string): Promise<string | null> {
  printSection("步骤 2: 创建微调任务");

  const jobConfig = {
    training_file: fileId,
    model: config.baseModel,
    hyperparameters: {
      n_epochs: 3,
    },
    suffix: "code-reviewer",
  };

  printStep("data", `基座模型: ${jobConfig.model}`);
  printStep("data", `训练轮数: ${jobConfig.hyperparameters.n_epochs} epochs`);
  printStep("data", `模型后缀: ${jobConfig.suffix}`);

  if (DRY_RUN) {
    printStep("think", "[DRY RUN] 跳过实际创建");
    printStep("result", "实际执行时，任务创建后通常需要 10-60 分钟完成训练");
    return "ftjob-dry-run-placeholder";
  }

  const client = createClient();

  const job = await client.fineTuning.jobs.create({
    training_file: fileId,
    model: jobConfig.model,
    hyperparameters: {
      n_epochs: jobConfig.hyperparameters.n_epochs,
    },
    suffix: jobConfig.suffix,
  });

  printStep("result", `✅ 任务创建成功: ${job.id}`);
  printStep("data", `  状态: ${job.status}`);
  printStep("data", `  模型: ${job.model}`);

  return job.id;
}

// ============================================================
// 步骤 3: 轮询任务状态
// ============================================================

/**
 * 轮询微调任务直到完成
 *
 * 任务状态流转：
 *   validating_files → queued → running → succeeded / failed / cancelled
 *
 * 轮询策略：
 *   - 前 5 分钟每 15 秒查一次
 *   - 之后每 60 秒查一次
 *   - 最长等待 2 小时
 */
async function pollJobStatus(jobId: string): Promise<string | null> {
  printSection("步骤 3: 等待训练完成");

  if (DRY_RUN) {
    printStep("think", "[DRY RUN] 模拟任务状态流转:");
    const mockStates = ["validating_files", "queued", "running", "running", "succeeded"];
    for (const state of mockStates) {
      printStep("observe", `  状态: ${state}`);
      await new Promise((r) => setTimeout(r, 300));
    }
    printStep("result", "微调完成！模型 ID: ft:gpt-4o-mini-2024-07-18:org::code-reviewer");
    return "ft:gpt-4o-mini-2024-07-18:org::code-reviewer";
  }

  const client = createClient();
  const startTime = Date.now();
  const maxWaitMs = 2 * 60 * 60 * 1000; // 2 小时

  while (Date.now() - startTime < maxWaitMs) {
    const job = await client.fineTuning.jobs.retrieve(jobId);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    printStep("observe", `[${elapsed}s] 状态: ${job.status}`);

    if (job.status === "succeeded") {
      printStep("result", `✅ 微调完成！模型 ID: ${job.fine_tuned_model}`);
      return job.fine_tuned_model;
    }

    if (job.status === "failed") {
      printStep("error", `❌ 微调失败: ${job.error?.message || "未知错误"}`);
      return null;
    }

    if (job.status === "cancelled") {
      printStep("error", "⛔ 微调任务已取消");
      return null;
    }

    const interval = elapsed < 300 ? 15_000 : 60_000;
    await new Promise((r) => setTimeout(r, interval));
  }

  printStep("error", "⏰ 等待超时（2小时）");
  return null;
}

// ============================================================
// 步骤 4: 查看训练事件和指标
// ============================================================

async function showTrainingEvents(jobId: string) {
  printSection("步骤 4: 训练事件与指标");

  if (DRY_RUN) {
    printStep("think", "[DRY RUN] 模拟训练指标:");
    const mockEvents = [
      { step: 10, loss: 2.45 },
      { step: 20, loss: 1.87 },
      { step: 30, loss: 1.23 },
      { step: 40, loss: 0.89 },
      { step: 50, loss: 0.67 },
    ];
    printStep("result", "训练损失 (Training Loss):");
    for (const e of mockEvents) {
      const bar = "█".repeat(Math.round(e.loss * 10));
      console.log(`  Step ${String(e.step).padStart(3)}: ${e.loss.toFixed(2)} ${bar}`);
    }
    printStep("think", "Loss 持续下降 → 模型在学习 ✅");
    printStep("think", "如果 Loss 不降或反弹 → 数据质量问题或过拟合");
    return;
  }

  const client = createClient();
  const events = await client.fineTuning.jobs.listEvents(jobId, { limit: 20 });

  printStep("result", "最近的训练事件:");
  for (const event of events.data) {
    printStep("observe", `  [${event.level}] ${event.message}`);
  }
}

// ============================================================
// 步骤 5: 使用微调模型
// ============================================================

async function testFineTunedModel(modelId: string) {
  printSection("步骤 5: 测试微调模型");

  const testCode = `function getDiscount(price, role) {\n  if (role == 'admin') return price * 0;\n  if (role == 'vip') return price * 0.8;\n  return price;\n}`;

  printStep("act", `测试代码:\n${testCode}`);

  if (DRY_RUN) {
    printStep("think", "[DRY RUN] 模拟微调模型输出:");
    console.log(`
## 审查结果
- 严重程度：中
- 类别：安全

## 问题描述
使用 == 而非 === 进行比较，且 admin 折扣为 0 存在逻辑风险。

## 建议修改
使用严格等于 ===，并确认 admin 免费逻辑是否符合业务需求。`);
    return;
  }

  const client = createClient();

  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      {
        role: "system",
        content: "你是一个专业的代码审查助手。请按固定格式输出审查意见。",
      },
      {
        role: "user",
        content: `请审查以下代码：\n\n\`\`\`\n${testCode}\n\`\`\``,
      },
    ],
    temperature: 0,
  });

  const output = response.choices[0]?.message?.content || "";
  printStep("result", `微调模型输出:\n${output}`);
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("🔧 Fine-tuning 实战 Part 2: OpenAI Fine-tuning API\n");

  if (DRY_RUN) {
    console.log("⚠️  DRY RUN 模式（不会产生费用）");
    console.log("   设置 ACTUALLY_RUN_FINETUNE=true 执行真实微调\n");
  }

  const fileId = await uploadTrainingFile();
  if (!fileId) return;

  const jobId = await createFineTuningJob(fileId);
  if (!jobId) return;

  const modelId = await pollJobStatus(jobId);
  if (!modelId) return;

  await showTrainingEvents(jobId);
  await testFineTunedModel(modelId);

  printSection("完整流程总结");
  printStep("result", "微调流程: 上传数据 → 创建任务 → 等待训练 → 查看指标 → 使用模型");
  printStep("result", `基座模型: ${config.baseModel}`);
  printStep("result", `微调模型: ${modelId}`);
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
