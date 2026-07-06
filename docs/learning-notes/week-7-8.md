# Week 7-8：RAG

## 本周目标

搭建一个最小但完整的 RAG 链路：私有 Markdown 文档进入知识库，经过分块、Embedding、向量库存储后，用户问题可以检索 top-k 片段并基于引用回答。

## 代码位置

- 示例包：`examples/rag-learning`
- 知识库：`examples/rag-learning/knowledge-base`
- QA 测试集：`examples/rag-learning/qa/test-set.json`
- 核心链路：`examples/rag-learning/src/lib/rag.ts`
- 向量库：`examples/rag-learning/src/lib/vector-store.ts`
- Embedding：`examples/rag-learning/src/lib/embedding.ts`

## 数据流

```txt
Markdown 文档
  ↓ loadMarkdownDocuments()
SourceDocument[]
  ↓ splitDocuments(chunkSize, overlap)
DocumentChunk[]
  ↓ embedText()
VectorRecord[]
  ↓ hybridSearch(question, topK)
SearchResult[]
  ↓ 生成带引用的回答
RagAnswer
```

## Chunk 策略对比

本示例提供两种策略：

| 策略 | chunkSize | overlap | 适合场景 |
|------|-----------|---------|----------|
| small | 500 | 80 | 更精确定位短事实 |
| large | 1000 | 160 | 保留更完整上下文 |

运行：

```bash
pnpm --filter @agent-mono/rag-learning compare
```

## Hybrid Search

本示例加入了 Hybrid Search：

```txt
最终分数 = vectorScore * 0.7 + keywordScore * 0.3
```

这样做的原因是：向量相似度更适合语义召回，关键词分数更适合专有名词、函数名、技术名词等精确匹配。

## 评估结果

运行：

```bash
pnpm --filter @agent-mono/rag-learning eval
```

当前结果：

```txt
检索命中率：10/10 = 100%
答案关键词命中率：8/10 = 80%
验收要求：检索命中率 >= 70%，当前 通过
```

## MCP / Function Calling / RAG 的区别

- Function Calling 解决“模型如何调用一个具体工具”。
- MCP 解决“Host 如何标准化连接外部工具服务”。
- RAG 解决“模型如何基于私有知识回答问题”。

三者可以组合：Cursor 通过 MCP 调用工具，工具内部可以执行 RAG 检索，最后模型再基于检索结果回答。
