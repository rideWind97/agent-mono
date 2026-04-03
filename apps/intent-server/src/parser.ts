/**
 * LLM 输出解析器 — 从 JSON 字符串中提取意图 & 槽位
 *
 * 这就是 LangChain 的 OutputParser 干的事
 * 手动实现需要处理：JSON 提取、格式校验、fallback 逻辑
 */
import { getIntentNames } from "./intents.js";

// ─── 解析结果类型 ─────────────────────────────────────────
export interface ParsedIntent {
  intent: string;
  confidence: number;
  slots: Record<string, unknown>;
  missingSlots: string[];
}

export interface SlotExtractionResult {
  extractedSlots: Record<string, unknown>;
}

// ─── 从 LLM 输出中提取 JSON ─────────────────────────────
function extractJSON(text: string): string | null {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // 尝试直接提取 {...} 块
  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (jsonMatch?.[0]) {
    return jsonMatch[0].trim();
  }

  return null;
}

// ─── 解析意图识别结果 ────────────────────────────────────
export function parseIntentResult(llmOutput: string): ParsedIntent {
  const jsonStr = extractJSON(llmOutput);

  if (!jsonStr) {
    // LLM 没返回有效 JSON，fallback 到 chitchat
    return {
      intent: "chitchat",
      confidence: 0.5,
      slots: {},
      missingSlots: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // 校验 intent 字段
    const intent = typeof parsed.intent === "string" ? parsed.intent : "chitchat";
    const validIntents = getIntentNames();
    const finalIntent = validIntents.includes(intent) ? intent : "chitchat";

    // 校验 confidence
    const rawConfidence = Number(parsed.confidence);
    const confidence =
      !isNaN(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
        ? rawConfidence
        : 0.5;

    // 校验 slots
    const slots =
      typeof parsed.slots === "object" && parsed.slots !== null
        ? (parsed.slots as Record<string, unknown>)
        : {};

    // 校验 missing_slots
    const missingSlots = Array.isArray(parsed.missing_slots)
      ? (parsed.missing_slots as unknown[]).filter(
          (s): s is string => typeof s === "string",
        )
      : [];

    return { intent: finalIntent, confidence, slots, missingSlots };
  } catch {
    // JSON 解析失败，fallback
    return {
      intent: "chitchat",
      confidence: 0.3,
      slots: {},
      missingSlots: [],
    };
  }
}

// ─── 解析槽位补全结果 ────────────────────────────────────
export function parseSlotExtraction(llmOutput: string): SlotExtractionResult {
  const jsonStr = extractJSON(llmOutput);

  if (!jsonStr) {
    return { extractedSlots: {} };
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const extractedSlots =
      typeof parsed.extracted_slots === "object" && parsed.extracted_slots !== null
        ? (parsed.extracted_slots as Record<string, unknown>)
        : {};

    return { extractedSlots };
  } catch {
    return { extractedSlots: {} };
  }
}
