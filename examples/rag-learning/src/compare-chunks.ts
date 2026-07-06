import { loadQaSet } from "./lib/loader.js";
import { buildRagPipeline } from "./lib/rag.js";
import { chunkStrategies } from "./lib/splitter.js";

function isHit(resultSources: string[], expectedSource: string) {
  // 判断期望文档是否出现在 top-k 检索结果里。
  // 只要出现，就说明这次检索“命中”。
  return resultSources.includes(expectedSource);
}

// 依次测试 small 和 large 两种分块策略。
// 目的：观察 chunkSize / overlap 改变后，检索命中率是否变化。
for (const strategy of [chunkStrategies.small, chunkStrategies.large]) {
  // 每种策略都会重新构建一套 RAG pipeline。
  // 因为不同分块策略会产生不同 chunks，也会写入不同向量。
  const rag = await buildRagPipeline({ strategy });
  const qaSet = await loadQaSet();
  let hits = 0;

  console.log(`\n=== Chunk Strategy: ${strategy.name} ===`);
  console.log(`chunkSize=${strategy.chunkSize}, overlap=${strategy.overlap}`);
  console.log(`documents=${rag.documents.length}, chunks=${rag.chunks.length}`);

  for (const qa of qaSet) {
    // 对测试集里的每个问题跑一次 RAG。
    const answer = await rag.ask(qa.question, 3);

    // 只取检索结果里的来源文档名，方便和 expectedSource 对比。
    const sources = answer.results.map((result) => result.chunk.sourcePath);
    const hit = isHit(sources, qa.expectedSource);
    hits += hit ? 1 : 0;

    // 对比脚本关注“期望文档是否进入 top-k”，不判断最终语言表达。
    console.log(`${hit ? "PASS" : "FAIL"} ${qa.question}`);
    console.log(`  expected=${qa.expectedSource}`);
    console.log(`  got=${sources.join(", ")}`);
  }

  // 命中率 = 命中题数 / 总题数。
  // Week 7-8 的验收要求是 >= 70%。
  const hitRate = hits / qaSet.length;
  console.log(`命中率：${hits}/${qaSet.length} = ${(hitRate * 100).toFixed(0)}%`);
}
