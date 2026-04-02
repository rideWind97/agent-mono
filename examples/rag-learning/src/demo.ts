import { sentenceChunk } from "./chunking.js";
import { CORPUS } from "./corpus.js";
import { contextRecall, faithfulness, relevancy } from "./evaluation.js";
import { expandQuery, hybridRetrieve, rerank } from "./retrieval.js";
import { InMemoryVectorStore } from "./vector-store.js";
import type { Chunk } from "./types.js";

function dedupeById(chunks: Chunk[]): Chunk[] {
  const map = new Map<string, Chunk>();
  for (const item of chunks) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function synthesizeAnswer(query: string, chunks: Chunk[]): string {
  const lines = chunks.slice(0, 3).map((c, i) => `${i + 1}. ${c.text}`);
  return [
    `问题：${query}`,
    "基于检索证据，我总结如下：",
    ...lines,
    "结论：RAG 的质量取决于检索质量（召回）与重排质量（精排）。",
  ].join("\n");
}

async function main() {
  const query = "RAG 的评估和优化该怎么做？";

  const chunks = sentenceChunk(CORPUS, 90, 20);
  const store = new InMemoryVectorStore();
  store.addChunks(chunks);

  const expandedQueries = expandQuery(query);

  const hybridCandidates = expandedQueries.flatMap((q) =>
    hybridRetrieve(store, chunks, q, 5).map((x) => x.chunk),
  );
  const uniqueCandidates = dedupeById(hybridCandidates);

  const mmrSelected = store.mmrSearch(query, 5, 0.75, 12);
  const merged = dedupeById([
    ...uniqueCandidates,
    ...mmrSelected.map((x) => x.chunk),
  ]);

  const reranked = rerank(
    query,
    merged.map((c) => ({ chunk: c, score: 1 })),
    4,
  );
  const finalChunks = reranked.map((x) => x.chunk);
  const answer = synthesizeAnswer(query, finalChunks);

  const metrics = {
    faithfulness: Number(faithfulness(answer, finalChunks).toFixed(3)),
    relevancy: Number(relevancy(query, answer).toFixed(3)),
    contextRecall: Number(contextRecall(finalChunks, CORPUS).toFixed(3)),
  };

  console.log("==== RAG DEMO ====");
  console.log("\n[Query]");
  console.log(query);

  console.log("\n[Expanded Queries]");
  console.log(expandedQueries);

  console.log("\n[Final Retrieved Chunks]");
  for (const chunk of finalChunks) {
    console.log(`- (${chunk.docId}) ${chunk.text}`);
  }

  console.log("\n[Answer]");
  console.log(answer);

  console.log("\n[Metrics]");
  console.log(metrics);
}

main().catch((error) => {
  console.error("[rag-demo] fatal:", error);
  process.exit(1);
});
