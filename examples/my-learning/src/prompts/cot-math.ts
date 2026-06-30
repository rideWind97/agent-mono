import type { ChatMessage } from "../lib/chat-api.js";

export const MATH_QUESTION =
  "一个水池有两个进水管 A、B。单独开 A 需 6 小时注满，单独开 B 需 4 小时注满。两管同时开，几小时注满？（假设排水口关闭）";

/** 直接要答案 */
export const MATH_ZERO_SHOT: ChatMessage[] = [
  {
    role: "system",
    content: "你是数学助手，直接给出最终答案，尽量简短。",
  },
];

/** Chain of Thought：要求分步推理 */
export const MATH_COT: ChatMessage[] = [
  {
    role: "system",
    content: `你是数学助手。请按以下格式回答：
1. 理解题意（1 句话）
2. 分步推理（每步一行，标 Step 1、Step 2…）
3. 最终答案（单独一行，格式：答案：X 小时）`,
  },
];

export function extractFinalAnswer(text: string) {
  const match = text.match(/答案[：:]\s*([\d.]+)\s*小时/);
  return match ? Number(match[1]) : null;
}

/** 正确解：1/(1/6+1/4) = 2.4 小时 */
export const MATH_CORRECT_ANSWER = 2.4;
