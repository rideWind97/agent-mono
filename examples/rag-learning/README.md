# RAG Learning Demo

This demo is designed for deep study of:

- chunking
- embeddings + vector index
- cosine similarity + MMR
- hybrid retrieval
- query expansion
- re-ranking
- faithfulness / relevancy / context recall metrics

## Run

```bash
cd examples/rag-learning
pnpm install
pnpm demo
```

## What happens

1. Load a small built-in corpus.
2. Chunk it with sentence strategy + overlap.
3. Build deterministic embeddings.
4. Retrieve with hybrid search.
5. Apply MMR to diversify.
6. Re-rank final candidates.
7. Synthesize answer.
8. Evaluate with metrics.

## Output sections

- query + expanded queries
- retrieval candidates
- selected chunks
- answer
- metrics:
  - `faithfulness`
  - `relevancy`
  - `contextRecall`

## How to experiment

- Change `chunkSize` / `overlap` in `src/demo.ts`.
- Change `lambda` in MMR.
- Disable query expansion and compare recall.
- Disable reranking and compare precision.
