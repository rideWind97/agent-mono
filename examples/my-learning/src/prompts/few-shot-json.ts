import type { ChatMessage } from "../lib/chat-api.js";

/** Zero-shot：仅描述任务，不给示例 */
export const FEW_SHOT_ZERO_SHOT: ChatMessage[] = [
  {
    role: "system",
    content:
      "分析用户评论的情感。只输出 JSON，格式：{\"sentiment\":\"positive|negative|neutral\",\"score\":0.0-1.0}，不要其他文字。",
  },
];

/** Few-shot：在 system 里给示例 */
export const FEW_SHOT_WITH_EXAMPLES: ChatMessage[] = [
  {
    role: "system",
    content: `分析评论情感，只输出 JSON：{"sentiment":"positive|negative|neutral","score":0.0-1.0}

示例 1
输入：这家餐厅服务太差了，再也不会来。
输出：{"sentiment":"negative","score":0.92}

示例 2
输入：天气不错，心情一般。
输出：{"sentiment":"neutral","score":0.55}

示例 3
输入：产品超预期，强烈推荐！
输出：{"sentiment":"positive","score":0.95}`,
  },
];

export const SENTIMENT_TEST_TEXT = "代码写得很优雅，但文档几乎没写，上线前有点慌。";

export function parseSentimentJson(text: string) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const obj = JSON.parse(jsonMatch[0]) as { sentiment?: string; score?: number };
    if (!obj.sentiment || typeof obj.score !== "number") return null;
    if (!["positive", "negative", "neutral"].includes(obj.sentiment)) return null;
    if (obj.score < 0 || obj.score > 1) return null;
    return obj;
  } catch {
    return null;
  }
}
