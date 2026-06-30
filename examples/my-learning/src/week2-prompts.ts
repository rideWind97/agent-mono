import { chatCompletion, formatUsage, type ChatMessage } from "./lib/chat-api.js";
import { assertLlmEnv } from "./lib/env.js";
import {
  CODE_REVIEW_SYSTEM_PROMPT,
  SAMPLE_CODE_FOR_REVIEW,
} from "./prompts/code-review.js";
import {
  FEW_SHOT_WITH_EXAMPLES,
  FEW_SHOT_ZERO_SHOT,
  parseSentimentJson,
  SENTIMENT_TEST_TEXT,
} from "./prompts/few-shot-json.js";
import {
  extractFinalAnswer,
  MATH_CORRECT_ANSWER,
  MATH_COT,
  MATH_QUESTION,
  MATH_ZERO_SHOT,
} from "./prompts/cot-math.js";

assertLlmEnv();

const RUNS = 5;

function section(title: string) {
  console.log(`\n${"=".repeat(48)}`);
  console.log(title);
  console.log("=".repeat(48));
}

async function demoCodeReview() {
  section("1. 代码审查助手（System Prompt）");

  const messages: ChatMessage[] = [
    { role: "system", content: CODE_REVIEW_SYSTEM_PROMPT },
    { role: "user", content: `请审查以下代码：\n\n\`\`\`javascript\n${SAMPLE_CODE_FOR_REVIEW}\n\`\`\`` },
  ];

  const { content, usage } = await chatCompletion(messages, { temperature: 0.2 });
  console.log(content);
  console.log(`\ntokens — ${formatUsage(usage)}`);
}

async function runSentimentBatch(label: string, base: ChatMessage[]) {
  let ok = 0;
  const outputs: string[] = [];

  for (let i = 0; i < RUNS; i++) {
    const messages: ChatMessage[] = [
      ...base,
      { role: "user", content: SENTIMENT_TEST_TEXT },
    ];
    const { content } = await chatCompletion(messages, { temperature: 0.3 });
    outputs.push(content);
    if (parseSentimentJson(content)) ok += 1;
  }

  console.log(`\n--- ${label}（${RUNS} 次）---`);
  console.log(`JSON 合法率: ${ok}/${RUNS}`);
  console.log("示例输出:", outputs[0]?.slice(0, 120));
  return { ok, outputs };
}

async function demoFewShotJson() {
  section("2. Few-shot vs Zero-shot（情感 JSON）");
  console.log(`测试文本: ${SENTIMENT_TEST_TEXT}\n`);

  const zero = await runSentimentBatch("Zero-shot", FEW_SHOT_ZERO_SHOT);
  const few = await runSentimentBatch("Few-shot", FEW_SHOT_WITH_EXAMPLES);

  return { zero, few };
}

async function demoCoTMath() {
  section("3. CoT 思维链（数学题）");
  console.log(`题目: ${MATH_QUESTION}\n`);

  const direct = await chatCompletion(
    [...MATH_ZERO_SHOT, { role: "user", content: MATH_QUESTION }],
    { temperature: 0 },
  );
  console.log("--- 无 CoT（直接回答）---");
  console.log(direct.content);
  const directAnswer = extractFinalAnswer(direct.content);
  console.log(`解析到的答案: ${directAnswer ?? "未能解析"}`);

  const cot = await chatCompletion(
    [...MATH_COT, { role: "user", content: MATH_QUESTION }],
    { temperature: 0 },
  );
  console.log("\n--- 有 CoT（分步推理）---");
  console.log(cot.content);
  const cotAnswer = extractFinalAnswer(cot.content);
  console.log(`解析到的答案: ${cotAnswer ?? "未能解析"}`);
  console.log(`参考答案: ${MATH_CORRECT_ANSWER} 小时`);

  return { direct, cot, directAnswer, cotAnswer };
}

async function main() {
  await demoCodeReview();
  const sentiment = await demoFewShotJson();
  const math = await demoCoTMath();

  section("4. 策略对比摘要");
  console.log(`
| 策略 | 任务 | 观察 |
|------|------|------|
| System Prompt | 代码审查 | 结构化输出 Bug/风格/安全，适合固定审查流程 |
| Zero-shot | 情感 JSON | 合法率 ${sentiment.zero.ok}/${RUNS}，偶发多余文字或格式偏差 |
| Few-shot | 情感 JSON | 合法率 ${sentiment.few.ok}/${RUNS}，格式更稳定 |
| 无 CoT | 数学题 | 答案 ${math.directAnswer ?? "?"}，${math.directAnswer === MATH_CORRECT_ANSWER ? "正确" : "可能跳步或错误"} |
| CoT | 数学题 | 答案 ${math.cotAnswer ?? "?"}，可观察中间推理步骤 |

详细结论见 docs/learning-notes/week2.md
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
