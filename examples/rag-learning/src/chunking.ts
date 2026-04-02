import type { Chunk, DocumentItem } from "./types.js";

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？.!?])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function sentenceChunk(
  docs: DocumentItem[],
  chunkSize = 80,
  overlap = 20,
): Chunk[] {
  const chunks: Chunk[] = [];

  for (const doc of docs) {
    const sentences = splitSentences(doc.text);
    let buffer = "";
    let start = 0;

    for (const sentence of sentences) {
      const candidate = buffer ? `${buffer}${sentence}` : sentence;
      if (candidate.length <= chunkSize) {
        buffer = candidate;
        continue;
      }

      if (buffer) {
        chunks.push({
          id: `${doc.id}-${chunks.length}`,
          docId: doc.id,
          text: buffer,
          start,
          end: start + buffer.length,
        });
        start = Math.max(0, start + buffer.length - overlap);
      }
      buffer = sentence;
    }

    if (buffer) {
      chunks.push({
        id: `${doc.id}-${chunks.length}`,
        docId: doc.id,
        text: buffer,
        start,
        end: start + buffer.length,
      });
    }
  }

  return chunks;
}
