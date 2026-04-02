import type { DocumentItem } from "./types.js";

export const CORPUS: DocumentItem[] = [
  {
    id: "doc-rag-core",
    title: "RAG Core",
    text:
      "RAG 由检索与生成组成。先从知识库检索上下文，再让模型基于上下文生成回答。RAG 的核心目标是减少幻觉并提升可解释性。",
    facts: ["RAG由检索与生成组成", "RAG可减少幻觉", "RAG提升可解释性"],
  },
  {
    id: "doc-metrics",
    title: "RAG Metrics",
    text:
      "RAG 评估常见指标包括 Faithfulness、Relevancy、Context Recall。Faithfulness 关注答案是否忠实于证据，Context Recall 关注检索是否覆盖关键证据。",
    facts: ["Faithfulness是忠实度", "Context Recall关注关键证据覆盖", "Relevancy衡量回答相关性"],
  },
  {
    id: "doc-optimization",
    title: "RAG Optimization",
    text:
      "RAG 优化常见方法有 Query Expansion、Hybrid Search、Re-ranking。Hybrid Search 融合稀疏检索与向量检索，Re-ranking 用于提升最终命中精度。",
    facts: ["Query Expansion是常见优化手段", "Hybrid Search融合稀疏与向量", "Re-ranking提升精度"],
  },
];
