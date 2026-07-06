// RAG 代码里最重要的是数据流。
// 这个文件集中定义每一步流过的数据长什么样，建议先读这里。

// SourceDocument 表示“刚从知识库加载出来的一整篇文档”。
// 例如 knowledge-base/01-rag-overview.md 会被读取成一个 SourceDocument。
export interface SourceDocument {
  // 文档唯一 ID。这个示例里直接使用文件名，例如 01-rag-overview.md。
  id: string;

  // 文档标题。优先从 Markdown 的一级标题 `# xxx` 提取。
  title: string;

  // 文档路径。后面回答引用来源时会用到。
  path: string;

  // 文档完整正文。
  text: string;
}

// ChunkingOptions 表示分块策略。
// RAG 通常不会直接检索整篇文章，而是先把文章切成 chunk。
export interface ChunkingOptions {
  // 策略名称，例如 small / large，方便打印对比结果。
  name: string;

  // 每个 chunk 大约保留多少字符。
  chunkSize: number;

  // 相邻 chunk 之间重复多少字符，避免关键信息刚好被切断。
  overlap: number;
}

// DocumentChunk 表示“被切出来的一小段文档”。
// 后续 Embedding、向量库存储、检索都是以 chunk 为单位。
export interface DocumentChunk {
  // chunk 唯一 ID，例如 01-rag-overview.md#0。
  id: string;

  // 这个 chunk 属于哪篇原始文档。
  documentId: string;

  // 原始文档路径，用于最终引用来源。
  sourcePath: string;

  // 原始文档标题。
  title: string;

  // 当前 chunk 在原文档里的序号。
  chunkIndex: number;

  // chunk 的正文内容。
  text: string;
}

// VectorRecord 表示“向量库里真正存的一条记录”。
// 一条记录 = 原始 chunk + 这个 chunk 对应的 embedding 向量。
export interface VectorRecord {
  chunk: DocumentChunk;
  embedding: number[];
}

// SearchResult 表示一次检索命中的结果。
// 它不只包含 chunk，还包含分数，方便观察为什么这条被排在前面。
export interface SearchResult {
  chunk: DocumentChunk;

  // 向量相似度分数：问题向量和 chunk 向量越接近，分数越高。
  vectorScore: number;

  // 关键词重叠分数：问题里的关键词在 chunk 中命中越多，分数越高。
  keywordScore: number;

  // 最终排序分数。这个示例里是 vectorScore 和 keywordScore 的加权和。
  score: number;
}

// RagAnswer 表示一次问答最终返回给用户的结果。
export interface RagAnswer {
  question: string;
  answer: string;

  // 引用来源，例如 04-hybrid-search.md#chunk-0。
  citations: string[];

  // 原始检索结果。保留它是为了学习和调试，能看到 top-k 是怎么来的。
  results: SearchResult[];
}

// QaCase 表示一条测试题。
// eval.ts 会用它来判断检索是否命中预期文档。
export interface QaCase {
  question: string;

  // 期望 top-k 检索结果中出现的文档。
  expectedSource: string;

  // 期望回答中出现的一些关键词，用来辅助判断回答质量。
  expectedKeywords: string[];
}
