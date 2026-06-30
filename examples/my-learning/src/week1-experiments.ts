import { chatCompletion, formatUsage } from "./lib/chat-api.js";
import { assertLlmEnv, llmEnv } from "./lib/env.js";

assertLlmEnv();

const QUESTION = "用一句话描述 JavaScript 的闭包是什么。";
const PROMPT: Parameters<typeof chatCompletion>[0] = [
  { role: "user", content: QUESTION },
];

async function runTemperatureExperiment() {
  console.log("=== 实验 1：Temperature 对比 ===\n");
  console.log(`问题: ${QUESTION}\n`);
  console.log(`模型: ${llmEnv.model}\n`);

  for (const temperature of [0, 1.2] as const) {
    const { content, usage } = await chatCompletion(PROMPT, { temperature });
    console.log(`--- temperature = ${temperature} ---`);
    console.log(content);
    console.log(`tokens — ${formatUsage(usage)}\n`);
  }

  console.log("观察要点:");
  console.log("- temperature=0 通常更稳定、表述更「标准」");
  console.log("- temperature=1.2 措辞更灵活，多次运行可能差异更大");
}

async function runTokenExperiment() {
  console.log("=== 实验 2：Token 用量统计 ===\n");

  const messages = [
    { role: "system" as const, content: "你是学习助手，回答简洁。" },
    { role: "user" as const, content: "什么是 Token？用 50 字以内解释。" },
  ];

  const { content, usage } = await chatCompletion(messages);

  console.log("回复:", content);
  console.log();

  if (!usage) {
    console.log("未返回 usage 字段，请检查 API 提供商是否支持。");
    return;
  }

  console.log("usage 字段解读:");
  console.log(`  prompt_tokens (input):     ${usage.prompt_tokens}`);
  console.log(`  completion_tokens (output): ${usage.completion_tokens}`);
  console.log(`  total_tokens:               ${usage.total_tokens}`);
  console.log();
  console.log("计费提示: 通常 input / output 单价不同，以各家 API 定价页为准。");
}

async function main() {
  await runTemperatureExperiment();
  console.log("\n" + "=".repeat(40) + "\n");
  await runTokenExperiment();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
