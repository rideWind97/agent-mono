import type { ChunkingOptions, DocumentChunk, SourceDocument } from "./types.js";

// 两种分块策略：
// - small：chunk 更短，检索更容易精确命中某个事实
// - large：chunk 更长，保留更多上下文，但可能混入多个主题
export const chunkStrategies = {
  small: { name: "small", chunkSize: 500, overlap: 80 },
  large: { name: "large", chunkSize: 1000, overlap: 160 },
} satisfies Record<string, ChunkingOptions>;

function normalizeText(text: string) {
  // 把换行、多个空格压成一个空格。
  // 这样按字符切分时更稳定，不会因为 Markdown 排版产生很多空白 chunk。
  return text.replace(/\s+/g, " ").trim();
}

function splitText(text: string, options: ChunkingOptions) {
  const normalized = normalizeText(text);
  const chunks: string[] = [];

  // start 表示当前 chunk 从正文的哪个字符开始。
  let start = 0;

  while (start < normalized.length) {
    // end 表示当前 chunk 到哪个字符结束。
    // 不能超过正文长度，所以用 Math.min。
    const end = Math.min(start + options.chunkSize, normalized.length);

    // slice(start, end) 就是当前切出来的一段文本。
    chunks.push(normalized.slice(start, end));

    if (end === normalized.length) {
      break;
    }

    // overlap 会让相邻 chunk 保留一段重复内容，减少“答案刚好被切开”的情况。
    // 例如上一段末尾定义了概念，下一段开头解释细节，重叠区能把二者连起来。
    start = Math.max(end - options.overlap, start + 1);
  }

  return chunks;
}

export function splitDocuments(documents: SourceDocument[], options: ChunkingOptions) {
  const chunks: DocumentChunk[] = [];

  for (const document of documents) {
    // 先把单篇文档切成多个纯文本 chunk。
    const textChunks = splitText(document.text, options);

    textChunks.forEach((text, chunkIndex) => {
      // 再给每个 chunk 补 metadata。
      // metadata 很重要：最终回答引用来源时，要知道 chunk 来自哪篇文档。
      chunks.push({
        id: `${document.id}#${chunkIndex}`,
        documentId: document.id,
        sourcePath: document.path,
        title: document.title,
        chunkIndex,
        text,
      });
    });
  }

  return chunks;
}
