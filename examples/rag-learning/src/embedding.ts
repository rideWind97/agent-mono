const DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hashToken(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i += 1) {
    h = (h * 31 + token.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function embed(text: string): number[] {
  const vec = Array(DIM).fill(0) as number[];
  const tokens = tokenize(text);
  if (!tokens.length) return vec;

  for (const token of tokens) {
    const idx = hashToken(token) % DIM;
    vec[idx] += 1;
  }

  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function keywordOverlapScore(query: string, text: string): number {
  const q = new Set(tokenize(query));
  const t = new Set(tokenize(text));
  if (!q.size) return 0;
  let hit = 0;
  for (const token of q) {
    if (t.has(token)) hit += 1;
  }
  return hit / q.size;
}
