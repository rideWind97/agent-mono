import type { Chunk, DocumentItem } from "./types.js";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function tokenSet(text: string): Set<string> {
  return new Set(normalize(text).split(/\s+/).filter(Boolean));
}

export function faithfulness(answer: string, contexts: Chunk[]): number {
  const ans = tokenSet(answer);
  if (!ans.size) return 0;
  const ctx = tokenSet(contexts.map((c) => c.text).join(" "));
  let hit = 0;
  for (const token of ans) {
    if (ctx.has(token)) hit += 1;
  }
  return hit / ans.size;
}

export function relevancy(query: string, answer: string): number {
  const q = tokenSet(query);
  const a = tokenSet(answer);
  if (!q.size) return 0;
  let hit = 0;
  for (const token of q) {
    if (a.has(token)) hit += 1;
  }
  return hit / q.size;
}

export function contextRecall(retrieved: Chunk[], docs: DocumentItem[]): number {
  const ctxText = normalize(retrieved.map((c) => c.text).join(" "));
  const goldFacts = docs.flatMap((d) => d.facts);
  if (!goldFacts.length) return 0;
  const hit = goldFacts.filter((fact) => normalize(fact).split(/\s+/).every((token) => !token || ctxText.includes(token))).length;
  return hit / goldFacts.length;
}
