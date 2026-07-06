import { buildRagPipeline } from "./lib/rag.js";

// 从命令行读取问题。
// 例如：
// pnpm --filter @agent-mono/rag-learning ask "Hybrid Search 为什么要结合关键词分数？"
//
// process.argv.slice(2) 表示取命令后面的所有参数。
const question = process.argv.slice(2).join(" ") || "RAG 的完整流程通常包含哪五步？";

// buildRagPipeline() 会完成离线索引阶段：
// 加载文档 -> 分块 -> 生成 embedding -> 写入向量库。
const rag = await buildRagPipeline();

// ask() 会完成在线查询阶段：
// 用户问题 -> 检索 topK 个 chunk -> 生成带引用的回答。
const answer = await rag.ask(question, 3);

console.log(`问题：${answer.question}`);
console.log(`\n回答：\n${answer.answer}`);
console.log(`\n引用：${answer.citations.join(", ") || "无"}`);

console.log("\nTop-K 检索结果：");
for (const [index, result] of answer.results.entries()) {
  // 分数拆开打印，是为了观察 Hybrid Search 中“向量分”和“关键词分”各自的影响。
  // score 是最终排序分数，vector 是向量相似度，keyword 是关键词重叠分。
  console.log(
    `${index + 1}. ${result.chunk.sourcePath}#${result.chunk.chunkIndex} score=${result.score.toFixed(
      3,
    )} vector=${result.vectorScore.toFixed(3)} keyword=${result.keywordScore.toFixed(3)}`,
  );
}
