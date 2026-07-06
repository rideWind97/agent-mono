import { loadQaSet } from "./lib/loader.js";
import { buildRagPipeline } from "./lib/rag.js";

function containsExpectedKeywords(answer: string, keywords: string[]) {
  // 简化版回答质量判断：
  // 只要回答中包含任意一个期望关键词，就认为关键词命中。
  // 真实项目可以用人工评估、LLM-as-judge 或更严格的规则。
  return keywords.some((keyword) => answer.includes(keyword));
}

// 构建默认 small chunk 策略的 RAG pipeline。
const rag = await buildRagPipeline();

// 读取 10 条测试问题。
const qaSet = await loadQaSet();

// retrievalHits：期望文档是否进入 top-k。
let retrievalHits = 0;

// answerKeywordHits：回答文本是否包含期望关键词。
let answerKeywordHits = 0;

console.log("=== RAG QA Evaluation ===");

for (const [index, qa] of qaSet.entries()) {
  // 每条测试题都执行一次完整 RAG 问答。
  const answer = await rag.ask(qa.question, 3);

  // sources 是这次 top-k 检索命中的文档列表。
  const sources = answer.results.map((result) => result.chunk.sourcePath);

  // 检索命中：期望文档是否出现在 top-k 里。
  const retrievalHit = sources.includes(qa.expectedSource);

  // 关键词命中：回答里是否出现测试集要求的关键词。
  const keywordHit = containsExpectedKeywords(answer.answer, qa.expectedKeywords);

  retrievalHits += retrievalHit ? 1 : 0;
  answerKeywordHits += keywordHit ? 1 : 0;

  // 这里的评估是“人工评估前的自动辅助”：先看期望文档是否进入 top-k，
  // 再看回答文本是否至少包含一个期望关键词。
  console.log(`\n${index + 1}. ${qa.question}`);
  console.log(`   retrieval=${retrievalHit ? "PASS" : "FAIL"} expected=${qa.expectedSource}`);
  console.log(`   keyword=${keywordHit ? "PASS" : "FAIL"} expected=${qa.expectedKeywords.join("/")}`);
  console.log(`   citations=${answer.citations.join(", ") || "无"}`);
}

// 计算整体指标。
const retrievalRate = retrievalHits / qaSet.length;
const answerKeywordRate = answerKeywordHits / qaSet.length;

console.log("\n=== Summary ===");
console.log(`检索命中率：${retrievalHits}/${qaSet.length} = ${(retrievalRate * 100).toFixed(0)}%`);
console.log(
  `答案关键词命中率：${answerKeywordHits}/${qaSet.length} = ${(answerKeywordRate * 100).toFixed(0)}%`,
);
console.log(`验收要求：检索命中率 >= 70%，当前 ${retrievalRate >= 0.7 ? "通过" : "未通过"}`);
