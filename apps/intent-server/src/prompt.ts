/**
 * Prompt 工程 — 手写 system prompt + few-shot 样例
 *
 * 核心思路：
 * 1. 把意图注册表序列化成 prompt 的一部分
 * 2. 用 few-shot 样例教 LLM 输出格式
 * 3. 严格要求 JSON 输出，方便解析
 *
 * 这就是 LangChain 的 PromptTemplate + OutputParser 干的事
 */
import type { IntentDef } from "./intents.js";
import { INTENT_REGISTRY } from "./intents.js";

// ─── 构建意图描述文本 ────────────────────────────────────
function buildIntentDescriptions(intents: IntentDef[]): string {
  return intents
    .map((intent) => {
      const slotsDesc =
        intent.slots.length > 0
          ? intent.slots
              .map((s) => {
                let desc = `    - ${s.name} (${s.type}${s.required ? ", 必填" : ", 可选"}): ${s.description}`;
                if (s.enumValues) {
                  desc += ` [可选值: ${s.enumValues.join(", ")}]`;
                }
                if (s.defaultValue !== undefined) {
                  desc += ` [默认: ${String(s.defaultValue)}]`;
                }
                return desc;
              })
              .join("\n")
          : "    （无参数）";

      const examplesDesc = intent.examples
        .map((e) => `    - "${e}"`)
        .join("\n");

      return `  ${intent.name}: ${intent.description}\n  参数:\n${slotsDesc}\n  示例用户输入:\n${examplesDesc}`;
    })
    .join("\n\n");
}

// ─── Few-shot 样例 ───────────────────────────────────────
const FEW_SHOT_EXAMPLES = `
示例 1:
用户: "北京明天天气怎么样？"
输出:
\`\`\`json
{
  "intent": "query_weather",
  "confidence": 0.95,
  "slots": {
    "city": "北京",
    "date": "明天"
  },
  "missing_slots": []
}
\`\`\`

示例 2:
用户: "帮我翻译一下"
输出:
\`\`\`json
{
  "intent": "translate_text",
  "confidence": 0.80,
  "slots": {},
  "missing_slots": ["text", "targetLang"]
}
\`\`\`

示例 3:
用户: "你好呀，今天过得怎么样？"
输出:
\`\`\`json
{
  "intent": "chitchat",
  "confidence": 0.98,
  "slots": {},
  "missing_slots": []
}
\`\`\`

示例 4:
用户: "提醒我开会"
输出:
\`\`\`json
{
  "intent": "set_reminder",
  "confidence": 0.90,
  "slots": {
    "content": "开会"
  },
  "missing_slots": ["time"]
}
\`\`\`
`.trim();

// ─── 构建完整的 System Prompt ────────────────────────────
export function buildSystemPrompt(): string {
  const intentDescriptions = buildIntentDescriptions(INTENT_REGISTRY);

  return `你是一个意图识别助手。你的任务是分析用户输入，识别意图并提取槽位参数。

## 可用意图列表

${intentDescriptions}

## 输出格式

你必须严格以 JSON 格式输出，不要输出任何其他文字：

\`\`\`json
{
  "intent": "意图名称",
  "confidence": 0.0 到 1.0 之间的置信度,
  "slots": {
    "参数名": "参数值"
  },
  "missing_slots": ["缺失的必填参数名"]
}
\`\`\`

## 规则

1. intent 必须是上面列出的意图名称之一
2. confidence 表示你对意图判断的置信度（0~1）
3. slots 中只包含你能从用户输入中提取到的参数值
4. missing_slots 列出所有 required=true 但用户未提供的参数
5. 如果用户输入不属于任何特定意图，使用 "chitchat"
6. 只输出 JSON，不要有任何解释文字

## Few-shot 参考

${FEW_SHOT_EXAMPLES}`;
}

// ─── 构建追问 Prompt（多轮槽位补全） ─────────────────────
export function buildSlotFillingPrompt(
  _intentName: string,
  missingSlots: string[],
  intentDef: IntentDef,
): string {
  const slotDescriptions = missingSlots
    .map((slotName) => {
      const slot = intentDef.slots.find((s) => s.name === slotName);
      if (!slot) return `  - ${slotName}`;
      let desc = `  - ${slot.name}: ${slot.description}`;
      if (slot.enumValues) {
        desc += `（可选: ${slot.enumValues.join(", ")}）`;
      }
      return desc;
    })
    .join("\n");

  return `用户想要执行「${intentDef.description}」，但还缺少以下必要信息：

${slotDescriptions}

请用简洁友好的中文，向用户提出追问以获取缺失信息。每个缺失参数用一句话追问。不要重复已知信息。`;
}

// ─── 构建槽位补全解析 Prompt ─────────────────────────────
export function buildSlotExtractionPrompt(
  intentDef: IntentDef,
  existingSlots: Record<string, unknown>,
  missingSlots: string[],
): string {
  const slotDescriptions = missingSlots
    .map((slotName) => {
      const slot = intentDef.slots.find((s) => s.name === slotName);
      if (!slot) return `  - ${slotName}`;
      let desc = `  - ${slot.name} (${slot.type}): ${slot.description}`;
      if (slot.enumValues) {
        desc += ` [可选值: ${slot.enumValues.join(", ")}]`;
      }
      return desc;
    })
    .join("\n");

  return `用户正在执行「${intentDef.description}」意图。

已知参数：
${JSON.stringify(existingSlots, null, 2)}

需要从用户最新回复中提取以下参数：
${slotDescriptions}

请严格以 JSON 格式输出提取到的参数，只包含能提取到的值：

\`\`\`json
{
  "extracted_slots": {
    "参数名": "参数值"
  }
}
\`\`\`

只输出 JSON，不要有其他文字。`;
}
