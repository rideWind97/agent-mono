# RAG Learning

Week 7-8 RAG 练习：实现一个可本地运行的「Markdown 知识库 → 分块 → Embedding → 向量库 → Hybrid Search → 问答 → 评估」完整链路。

这个示例刻意不依赖真实 Embedding API。它使用本地 Hashing Embedding 和内存向量库，方便先理解 RAG 数据流。后续可以把 `embedText()` 换成 OpenAI Embeddings，把 `InMemoryVectorStore` 换成 Chroma、FAISS 或 pgvector。

## 目录

- `knowledge-base/`：5 篇 Markdown 知识库文档
- `qa/test-set.json`：10 条 QA 测试集
- `src/lib/loader.ts`：加载 Markdown 和 QA 测试集
- `src/lib/splitter.ts`：chunk size / overlap 分块策略
- `src/lib/embedding.ts`：本地 Hashing Embedding、tokenize、cosine similarity
- `src/lib/vector-store.ts`：内存向量库、similarity search、hybrid search
- `src/lib/rag.ts`：把加载、分块、索引、检索、回答串起来
- `src/ask.ts`：单次问答演示
- `src/compare-chunks.ts`：对比 small / large 两种 chunk 策略
- `src/eval.ts`：跑 10 条 QA 测试集并计算命中率

## 运行

```bash
pnpm --filter @agent-mono/rag-learning ask "RAG 的完整流程通常包含哪五步？"
pnpm --filter @agent-mono/rag-learning compare
pnpm --filter @agent-mono/rag-learning eval
```

也可以用根命令：

```bash
pnpm week7:rag
pnpm week8:rag:compare
pnpm week8:rag:eval
```

## 当前验收结果

`pnpm --filter @agent-mono/rag-learning eval` 当前结果：

```txt
检索命中率：10/10 = 100%
答案关键词命中率：8/10 = 80%
验收要求：检索命中率 >= 70%，当前 通过
```

## 学习顺序

建议按这个顺序读代码：

1. `src/lib/types.ts`：先看 RAG 里有哪些数据结构。
2. `src/lib/loader.ts`：理解文档如何进入系统。
3. `src/lib/splitter.ts`：理解 chunk size 和 overlap。
4. `src/lib/embedding.ts`：理解文本如何变成向量。
5. `src/lib/vector-store.ts`：理解 similarity search 和 hybrid search。
6. `src/lib/rag.ts`：看完整链路如何串起来。
