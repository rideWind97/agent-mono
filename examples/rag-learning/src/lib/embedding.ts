// 这个文件模拟了一个“非常简化版 Embedding 模型”。
//
// 真实 RAG 里通常会调用 OpenAI Embeddings、bge、e5 等模型：
//   文本 -> 模型 -> 一组数字向量
//
// 为了不依赖外部 API，本示例用 Hashing Embedding：
//   文本 -> 分词 -> token hash 到固定维度 -> 得到向量
//
// 它不是真正懂语义的模型，但足够帮助你理解 RAG 的主流程。

// 向量维度。
// 真实 embedding 可能是 768 / 1024 / 1536 维。
// 这里用 256 维，方便本地演示。
const embeddingDimensions = 256;

// 停用词：这些词太常见，对区分文档帮助不大。
// 例如“的”“是”“什么”，几乎所有问题里都可能出现。
const stopWords = new Set([
  "的",
  "了",
  "和",
  "是",
  "在",
  "里",
  "什么",
  "为什么",
  "the",
  "and",
  "is",
  "a",
  "to",
]);

function hashToken(token: string) {
  // 这是一个简单 hash 函数。
  // 目标是：同一个 token 每次都映射到同一个数字。
  // 后面会用这个数字决定 token 落到向量的哪个位置。
  let hash = 2166136261;

  for (const char of token) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash);
}

function buildChineseNgrams(text: string) {
  // 英文天然有空格，比较好分词。
  // 中文没有天然空格，如果直接把一句中文当成一个 token，匹配效果会很差。
  //
  // 所以这里用 n-gram：
  // “向量库负责保存” 会切成：
  // - 2 字：向量、量库、库负、负责...
  // - 3 字：向量库、量库负、库负责...
  // - 4 字：向量库负、量库负责...
  //
  // 这样问题里的“向量库”更容易和文档里的“向量库负责...”匹配上。
  const segments = text.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const tokens: string[] = [];

  for (const segment of segments) {
    for (const size of [2, 3, 4]) {
      for (let index = 0; index <= segment.length - size; index++) {
        tokens.push(segment.slice(index, index + size));
      }
    }
  }

  return tokens;
}

export function tokenize(text: string) {
  // 统一转小写，避免 RAG / rag 被当成两个不同词。
  const normalized = text.toLowerCase();

  // 英文、数字、下划线、加减号等，按正则直接抽取。
  // 例如 Hybrid Search 会得到 hybrid、search。
  const latinTokens: string[] = normalized.match(/[a-z0-9_+-]+/g) ?? [];

  // 中文用 2-4 字 n-gram 模拟分词。
  const chineseTokens = buildChineseNgrams(normalized);

  // 中英文 token 合并后，再去掉停用词。
  const mixedTokens = latinTokens.concat(chineseTokens);

  return mixedTokens.filter((token) => !stopWords.has(token));
}

export function embedText(text: string) {
  // 先创建一个全 0 向量。
  // 可以把它想象成 256 个格子，每个格子统计一部分 token 出现次数。
  const vector = Array.from({ length: embeddingDimensions }, () => 0);

  for (const token of tokenize(text)) {
    // hashToken(token) % embeddingDimensions：
    // 把任意 token 映射到 0-255 之间的某个位置。
    const index = hashToken(token) % embeddingDimensions;

    // Hashing Embedding 的核心：把 token 稳定映射到固定维度。
    // 真实 Embedding 会学习语义；这里用词频近似，只为演示 RAG 数据流。
    vector[index] = (vector[index] ?? 0) + 1;
  }

  // 计算向量长度，用于归一化。
  // 归一化后，长文本不会因为 token 更多而天然分数更高。
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  // 如果文本没有有效 token，就返回全 0 向量。
  // 否则把每个维度都除以向量长度。
  return length === 0 ? vector : vector.map((value) => value / length);
}

export function cosineSimilarity(left: number[], right: number[]) {
  // 余弦相似度：衡量两个向量方向是否接近。
  // 分数越高，表示 query 和 chunk 越相似。
  //
  // 因为 embedText() 已经做过归一化，所以这里点积就近似等于余弦相似度。
  let score = 0;

  for (let index = 0; index < left.length; index++) {
    score += (left[index] ?? 0) * (right[index] ?? 0);
  }

  return score;
}

export function keywordOverlapScore(question: string, text: string) {
  // 关键词重叠分数用于 Hybrid Search。
  // 它不看语义，只看问题中的 token 有多少也出现在 chunk 里。
  const queryTokens = new Set(tokenize(question));
  const textTokens = new Set(tokenize(text));

  if (queryTokens.size === 0) {
    return 0;
  }

  let hits = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      hits += 1;
    }
  }

  // 命中数 / 问题 token 数。
  // 例如问题有 10 个 token，chunk 命中 4 个，则 keywordScore = 0.4。
  return hits / queryTokens.size;
}
