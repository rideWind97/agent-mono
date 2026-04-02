import { keywordOverlapScore } from "./embedding.js";
import type { Chunk, ScoredChunk } from "./types.js";
import { InMemoryVectorStore } from "./vector-store.js";

const QUERY_EXPANSION: Record<string, string[]> = {
  rag: ["retrieval augmented generation", "检索增强生成"],
  评估: ["faithfulness", "relevancy", "context recall"],
  优化: ["hybrid search", "re-ranking", "query expansion"],
};

export function expandQuery(query: string): string[] {
  const lowered = query.toLowerCase();
  const expansions = new Set<string>([query]);
  for (const [k, items] of Object.entries(QUERY_EXPANSION)) {
    if (lowered.includes(k)) {
      for (const item of items) expansions.add(`${query} ${item}`);
    }
  }
  return Array.from(expansions);
}

export function hybridRetrieve(
  store: InMemoryVectorStore,
  allChunks: Chunk[],
  query: string,
  k: number,
): ScoredChunk[] {
  const dense = store.similaritySearch(query, Math.max(k, 8));
  const denseMap = new Map(dense.map((x) => [x.chunk.id, x.score]));

  const scored = allChunks.map((chunk) => {
    const denseScore = denseMap.get(chunk.id) ?? 0;
    const sparseScore = keywordOverlapScore(query, chunk.text);
    const score = 0.65 * denseScore + 0.35 * sparseScore;
    return { chunk, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

export function rerank(query: string, items: ScoredChunk[], topK: number): ScoredChunk[] {
  const reranked = items.map((item) => {
    const lexical = keywordOverlapScore(query, item.chunk.text);
    const lengthPenalty = Math.max(0, (item.chunk.text.length - 140) / 200);
    const score = item.score * 0.7 + lexical * 0.4 - lengthPenalty * 0.1;
    return { ...item, score };
  });

  return reranked.sort((a, b) => b.score - a.score).slice(0, topK);
}
