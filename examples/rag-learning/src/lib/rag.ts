import { loadMarkdownDocuments } from "./loader.js";
import { chunkStrategies } from "./splitter.js";
import { splitDocuments } from "./splitter.js";
import { InMemoryVectorStore } from "./vector-store.js";
import type { ChunkingOptions, RagAnswer, SearchResult } from "./types.js";

export interface BuildRagOptions {
  // 可选分块策略。
  // 不传时默认使用 small 策略。
  strategy?: ChunkingOptions;
}

function createCitation(result: SearchResult) {
  // 把检索结果变成引用格式。
  // 例如：04-hybrid-search.md#chunk-0
  return `${result.chunk.sourcePath}#chunk-${result.chunk.chunkIndex}`;
}

function pickEvidenceSentences(results: SearchResult[]) {
  // 从 top-k 检索结果里取前 3 条证据片段。
  // 这里没有调用 LLM，而是直接展示检索到的上下文，方便你观察 RAG 是否检索对了。
  return results
    .slice(0, 3)
    .map((result) => {
      const snippet = result.chunk.text.slice(0, 180);
      return `- [${createCitation(result)}] ${snippet}${result.chunk.text.length > 180 ? "..." : ""}`;
    })
    .join("\n");
}

export async function buildRagPipeline(options: BuildRagOptions = {}) {
  // 选择分块策略。
  // small / large 会影响 chunk 数量和检索质量。
  const strategy = options.strategy ?? chunkStrategies.small;

  // 第一步：加载 Markdown 知识库。
  // 输出是一整篇一整篇的 SourceDocument。
  const documents = await loadMarkdownDocuments();

  // 第二步：把整篇文档切成多个 chunk。
  // RAG 通常以 chunk 为检索单位，而不是整篇文档。
  const chunks = splitDocuments(documents, strategy);

  // 第三步：创建一个空的内存向量库。
  const vectorStore = new InMemoryVectorStore();

  // 这里对应 RAG 的离线索引阶段：
  // 1. loadMarkdownDocuments() 加载知识库
  // 2. splitDocuments() 分块
  // 3. addDocuments() 生成 embedding 并写入向量库
  vectorStore.addDocuments(chunks);

  return {
    // 这些字段暴露出来主要是为了学习和调试。
    // compare-chunks.ts 会用 documents/chunks 看不同策略切出了多少片段。
    strategy,
    documents,
    chunks,
    vectorStore,
    async ask(question: string, topK = 3): Promise<RagAnswer> {
      // 这里对应 RAG 的在线查询阶段：
      // 1. 把用户问题 embed 成 query vector
      // 2. 从向量库检索 top-k chunks
      // 3. 基于检索结果生成回答
      const results = vectorStore.hybridSearch(question, topK);

      // citations 是去重后的引用列表。
      // 一个回答可能引用多个 chunk，也可能多个 chunk 来自同一篇文档。
      const citations = Array.from(new Set(results.map(createCitation)));

      // bestScore 是最高分结果。
      // 如果最高分都很低，说明知识库可能没有足够依据。
      const bestScore = results[0]?.score ?? 0;

      if (bestScore < 0.08) {
        // 这是 RAG 很重要的安全行为：
        // 检索不到证据时，不要编答案，要明确说不知道。
        return {
          question,
          answer: "知识库中没有找到足够依据，不能可靠回答这个问题。",
          citations: [],
          results,
        };
      }

      return {
        question,
        // 为了让学习重点落在 RAG 链路，这里先做“抽取式回答”：
        // 直接引用检索到的证据片段，而不是调用 LLM 改写。
        // 后续接入大模型时，可以把这些 evidence 放进 Prompt，让模型基于证据总结。
        answer: [`根据知识库检索结果，可以参考以下依据：`, pickEvidenceSentences(results)].join(
          "\n",
        ),
        citations,
        results,
      };
    },
  };
}
