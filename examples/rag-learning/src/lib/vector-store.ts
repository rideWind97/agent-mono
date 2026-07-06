import { cosineSimilarity, embedText, keywordOverlapScore } from "./embedding.js";
import type { DocumentChunk, SearchResult, VectorRecord } from "./types.js";

// 一个最小内存向量库。
//
// 真实项目里你可能会用 Chroma / FAISS / Milvus / pgvector。
// 它们的核心职责和这里一样：
// 1. 保存 chunk
// 2. 保存 chunk 对应的 embedding
// 3. 用户提问时，找出最相关的 top-k chunks
export class InMemoryVectorStore {
  // records 就是“向量库里的所有数据”。
  // 每条记录包含：chunk 原文 + chunk embedding。
  private readonly records: VectorRecord[] = [];

  addDocuments(chunks: DocumentChunk[]) {
    // addDocuments 对应 RAG 的“索引阶段”。
    // 一般在文档入库时执行，而不是每次用户提问都执行。
    for (const chunk of chunks) {
      this.records.push({
        chunk,
        // 写入向量库时就提前算好 chunk embedding，查询时只需要算 query embedding。
        embedding: embedText(chunk.text),
      });
    }
  }

  similaritySearch(question: string, topK: number) {
    // 用户问题也要转成 embedding。
    // 只有 query 和 chunk 都是向量，才能计算相似度。
    const queryEmbedding = embedText(question);

    return this.records
      .map<SearchResult>((record) => {
        // 计算 query 向量和当前 chunk 向量的相似度。
        const vectorScore = cosineSimilarity(queryEmbedding, record.embedding);

        return {
          chunk: record.chunk,
          vectorScore,
          keywordScore: 0,
          score: vectorScore,
        };
      })
      // 分数高的排前面。
      .sort((left, right) => right.score - left.score)
      // 只取 topK 条，避免把整篇知识库都塞给后续回答阶段。
      .slice(0, topK);
  }

  hybridSearch(question: string, topK: number) {
    // Hybrid Search = 向量检索 + 关键词检索。
    //
    // 为什么需要它？
    // - 向量检索适合语义相近
    // - 关键词检索适合精确词，例如 Hybrid Search、pgvector、错误码
    const queryEmbedding = embedText(question);

    return this.records
      .map<SearchResult>((record) => {
        const vectorScore = cosineSimilarity(queryEmbedding, record.embedding);
        const keywordScore = keywordOverlapScore(question, record.chunk.text);

        // Hybrid Search：用向量分数找语义相近内容，用关键词分数保护专有名词和精确匹配。
        // 权重不是固定真理，实际项目应该通过测试集调参。
        const score = vectorScore * 0.7 + keywordScore * 0.3;

        return {
          chunk: record.chunk,
          vectorScore,
          keywordScore,
          score,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  count() {
    // 用于调试：看看向量库里当前有多少个 chunk。
    return this.records.length;
  }
}
