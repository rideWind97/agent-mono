/**
 * 多轮槽位补全逻辑
 *
 * 核心设计思路：
 * 1. 维护一个 session，记录当前意图、已填槽位、缺失槽位
 * 2. 当有 missing_slots 时，生成追问 prompt 让用户补充
 * 3. 用户回答后，再次调用 LLM 提取新的槽位值
 * 4. 循环直到所有必填槽位都填满
 *
 * 这就是 LangChain Agent 的多轮对话 + Memory 干的事
 */
import type { IntentDef } from "./intents.js";
import { findIntent } from "./intents.js";
import {
  buildSlotFillingPrompt,
  buildSlotExtractionPrompt,
} from "./prompt.js";
import type { LLMCallOptions } from "./llm.js";
import { chat } from "./llm.js";
import { parseSlotExtraction } from "./parser.js";

// ─── 会话状态 ─────────────────────────────────────────────
export interface SlotFillingSession {
  /** 会话 ID */
  sessionId: string;
  /** 识别出的意图名称 */
  intentName: string;
  /** 意图定义 */
  intentDef: IntentDef;
  /** 已收集的槽位值 */
  filledSlots: Record<string, unknown>;
  /** 仍然缺失的必填槽位名称 */
  missingSlots: string[];
  /** 是否已完成（所有必填槽位已填满） */
  isComplete: boolean;
  /** 追问对话历史 */
  conversationHistory: Array<{ role: "assistant" | "user"; content: string }>;
}

// ─── 内存 Session 存储 ──────────────────────────────────
const sessions = new Map<string, SlotFillingSession>();

// ─── 创建新的槽位补全会话 ────────────────────────────────
export function createSession(
  sessionId: string,
  intentName: string,
  initialSlots: Record<string, unknown>,
  missingSlots: string[],
): SlotFillingSession {
  const intentDef = findIntent(intentName);
  if (!intentDef) {
    throw new Error(`Unknown intent: ${intentName}`);
  }

  const session: SlotFillingSession = {
    sessionId,
    intentName,
    intentDef,
    filledSlots: { ...initialSlots },
    missingSlots: [...missingSlots],
    isComplete: missingSlots.length === 0,
    conversationHistory: [],
  };

  sessions.set(sessionId, session);
  return session;
}

// ─── 获取会话 ──────────────────────────────────────────
export function getSession(sessionId: string): SlotFillingSession | undefined {
  return sessions.get(sessionId);
}

// ─── 删除会话 ──────────────────────────────────────────
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// ─── 生成追问文本 ─────────────────────────────────────────
export async function generateFollowUp(
  session: SlotFillingSession,
  options: LLMCallOptions = {},
): Promise<string> {
  const prompt = buildSlotFillingPrompt(
    session.intentName,
    session.missingSlots,
    session.intentDef,
  );

  const result = await chat(prompt, "请生成追问", options);
  const followUp = result.content.trim();

  // 记录到对话历史
  session.conversationHistory.push({
    role: "assistant",
    content: followUp,
  });

  return followUp;
}

// ─── 处理用户回答，提取新槽位 ────────────────────────────
export async function processUserReply(
  session: SlotFillingSession,
  userReply: string,
  options: LLMCallOptions = {},
): Promise<{
  newSlots: Record<string, unknown>;
  stillMissing: string[];
  isComplete: boolean;
}> {
  // 记录用户回复
  session.conversationHistory.push({
    role: "user",
    content: userReply,
  });

  // 构建槽位提取 prompt
  const extractionPrompt = buildSlotExtractionPrompt(
    session.intentDef,
    session.filledSlots,
    session.missingSlots,
  );

  // 调用 LLM 提取新槽位
  const result = await chat(extractionPrompt, userReply, options);
  const { extractedSlots } = parseSlotExtraction(result.content);

  // 合并新提取的槽位
  const newSlots: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extractedSlots)) {
    if (session.missingSlots.includes(key) && value !== undefined && value !== "") {
      session.filledSlots[key] = value;
      newSlots[key] = value;
    }
  }

  // 重新计算缺失槽位
  session.missingSlots = session.intentDef.slots
    .filter((s) => s.required && session.filledSlots[s.name] === undefined)
    .map((s) => s.name);

  session.isComplete = session.missingSlots.length === 0;

  // 应用默认值
  if (session.isComplete) {
    for (const slot of session.intentDef.slots) {
      if (
        slot.defaultValue !== undefined &&
        session.filledSlots[slot.name] === undefined
      ) {
        session.filledSlots[slot.name] = slot.defaultValue;
      }
    }
  }

  return {
    newSlots,
    stillMissing: session.missingSlots,
    isComplete: session.isComplete,
  };
}
