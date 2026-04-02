export interface DocumentItem {
  id: string;
  title: string;
  text: string;
  facts: string[];
}

export interface Chunk {
  id: string;
  docId: string;
  text: string;
  start: number;
  end: number;
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}
