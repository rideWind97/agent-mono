import { cosine, embed } from "./embedding.js";
import type { Chunk, ScoredChunk } from "./types.js";

interface IndexedChunk {
  chunk: Chunk;
  vector: number[];
}

export class InMemoryVectorStore {
  private readonly data: IndexedChunk[] = [];

  addChunks(chunks: Chunk[]): void {
    for (const chunk of chunks) {
      this.data.push({
        chunk,
        vector: embed(chunk.text),
      });
    }
  }

  similaritySearch(query: string, k: number): ScoredChunk[] {
    const q = embed(query);
    return this.data
      .map((item) => ({
        chunk: item.chunk,
        score: cosine(q, item.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  mmrSearch(query: string, k: number, lambda = 0.7, fetchK = 10): ScoredChunk[] {
    const candidates = this.similaritySearch(query, fetchK);
    const selected: ScoredChunk[] = [];
    const qVec = embed(query);
    const selectedVectors: number[][] = [];

    while (selected.length < k && candidates.length) {
      let bestIdx = 0;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (let i = 0; i < candidates.length; i += 1) {
        const cand = candidates[i];
        const candVec = embed(cand.chunk.text);
        const relevance = cand.score;
        const diversityPenalty = selectedVectors.length
          ? Math.max(...selectedVectors.map((sv) => cosine(candVec, sv)))
          : 0;
        const mmr = lambda * relevance - (1 - lambda) * diversityPenalty;
        if (mmr > bestScore) {
          bestScore = mmr;
          bestIdx = i;
        }
      }

      const [best] = candidates.splice(bestIdx, 1);
      selected.push(best);
      selectedVectors.push(embed(best.chunk.text));
    }

    // keep stable order by relevance for readability
    return selected.sort((a, b) => b.score - a.score).map((item) => ({
      ...item,
      score: cosine(qVec, embed(item.chunk.text)),
    }));
  }
}
