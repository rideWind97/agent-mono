# 意图识别系统 — 从零到一详解

> 本文详细介绍 `apps/intent-server` 中的意图识别系统如何工作，包括架构设计、核心流程、关键代码和原理解释。  
> 整个项目**不使用任何 LangChain 代码**，完全基于 OpenAI SDK + Zod + Fastify 手动实现。

---

## 目录

1. [系统总览](#1-系统总览)
2. [核心架构](#2-核心架构)
3. [意图定义与注册](#3-意图定义与注册)
4. [Prompt 工程](#4-prompt-工程)
5. [LLM 调用封装](#5-llm-调用封装)
6. [输出解析器](#6-输出解析器)
7. [多轮槽位补全](#7-多轮槽位补全)
8. [工具分发器](#8-工具分发器)
9. [完整流程串联](#9-完整流程串联)
10. [与 LangChain 对比](#10-与-langchain-对比)
11. [扩展指南](#11-扩展指南)

---

## 1. 系统总览

### 什么是意图识别？

意图识别（Intent Recognition）是 NLU（自然语言理解）的核心任务之一。它的目标是：

> **输入一段自然语言文本 → 输出用户想做什么（意图）+ 做这件事需要的参数（槽位）**

例如：

| 用户输入 | 意图 | 槽位 |
|---------|------|------|
| "北京明天天气怎么样？" | `query_weather` | `city=北京, date=明天` |
| "帮我把你好翻译成英文" | `translate_text` | `text=你好, targetLang=英文` |
| "提醒我开会" | `set_reminder` | `content=开会, time=?（缺失）` |
| "你好呀" | `chitchat` | （无参数） |

### 技术栈

| 层次 | 技术选型 | 说明 |
|------|---------|------|
| Web 框架 | Fastify | 高性能 Node.js 框架 |
| LLM 调用 | OpenAI SDK | 原生 SDK，兼容 DeepSeek 等 |
| 类型校验 | TypeScript | 静态类型保障 |
| 环境配置 | dotenv | .env 文件管理 |

### 项目目录结构

```
apps/intent-server/
├── src/
│   ├── config.ts         # 配置管理（环境变量）
│   ├── intents.ts        # 意图定义 & 槽位 Schema
│   ├── prompt.ts         # Prompt 工程（System Prompt + Few-shot）
│   ├── llm.ts            # LLM 调用封装（OpenAI SDK）
│   ├── parser.ts         # LLM 输出解析器
│   ├── slot-filler.ts    # 多轮槽位补全逻辑
│   ├── dispatcher.ts     # 工具分发器
│   └── index.ts          # Fastify 入口 & 路由
├── package.json
└── tsconfig.json
```

---

## 2. 核心架构

整个系统的数据流如下：

```
用户输入
  │
  ▼
┌─────────────────────────────────────────────┐
│  Step 1: 构建 System Prompt                  │
│  （意图注册表 → Prompt 模板 → Few-shot 样例） │
└─────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────┐
│  Step 2: 调用 LLM                           │
│  （System Prompt + 用户输入 → LLM → JSON）   │
└─────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────┐
│  Step 3: 解析 LLM 输出                       │
│  （提取 JSON → 校验字段 → 得到意图+槽位）     │
└─────────────────────────────────────────────┘
  │
  ▼
┌──────────────── 分支判断 ────────────────────┐
│                                              │
│  有缺失槽位？                                │
│  ├─ YES → 进入多轮槽位补全                    │
│  │         （追问 → 用户回答 → 提取 → 循环）  │
│  └─ NO  → 执行工具分发                       │
│                                              │
└──────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────┐
│  Step 4: 工具分发                            │
│  （意图名 → Handler → 执行 → 返回结果）      │
└─────────────────────────────────────────────┘
```

### 核心设计理念

1. **声明式意图注册** — 添加新意图只需在注册表中加一条记录
2. **Prompt 驱动** — 通过精心设计的 Prompt 让 LLM 完成意图识别
3. **结构化输出** — 强制 LLM 输出 JSON，方便程序解析
4. **多轮补全** — 通过 Session 管理实现缺失槽位的追问补全
5. **Handler 映射** — 意图到执行的解耦分发

---

## 3. 意图定义与注册

> 文件：`src/intents.ts`  
> 对应 LangChain 中的：Tool 定义

### 3.1 类型定义

首先定义了两个核心接口：**槽位定义**和**意图定义**。

```typescript
// 槽位定义 — 描述一个参数的 Schema
export interface SlotDef {
  /** 槽位名称，如 "city" */
  name: string;
  /** 槽位类型 */
  type: "string" | "number" | "boolean" | "enum";
  /** 中文描述，用于追问时展示 */
  description: string;
  /** 是否必填 */
  required: boolean;
  /** 枚举可选值（type 为 enum 时使用） */
  enumValues?: string[];
  /** 默认值（可选，用户不提供时自动填充） */
  defaultValue?: string | number | boolean;
}

// 意图定义 — 描述一种用户意图
export interface IntentDef {
  /** 意图唯一标识，如 "query_weather" */
  name: string;
  /** 意图中文描述 */
  description: string;
  /** 触发示例（用于 Few-shot Prompt） */
  examples: string[];
  /** 该意图需要的槽位列表 */
  slots: SlotDef[];
}
```

**设计要点：**
- `SlotDef` 的 `type` 字段限制了槽位的数据类型，类似于 Zod schema 的约束
- `examples` 字段用于 Few-shot 学习，让 LLM 通过示例理解意图
- `required` 字段决定了是否需要多轮追问

### 3.2 意图注册表

所有意图都注册在一个数组中，系统会自动读取并生成 Prompt：

```typescript
export const INTENT_REGISTRY: IntentDef[] = [
  {
    name: "query_weather",
    description: "查询某个城市的天气",
    examples: [
      "北京今天天气怎么样？",
      "上海明天会下雨吗？",
      "深圳下周天气",
    ],
    slots: [
      {
        name: "city",
        type: "string",
        description: "要查询天气的城市名称",
        required: true,
      },
      {
        name: "date",
        type: "string",
        description: '查询日期，如"今天"、"明天"、"下周一"',
        required: false,
        defaultValue: "今天",   // ← 不填则自动使用默认值
      },
    ],
  },
  {
    name: "translate_text",
    description: "翻译文本到指定语言",
    examples: [
      '帮我把"你好"翻译成英文',
      "translate hello to Japanese",
    ],
    slots: [
      {
        name: "text",
        type: "string",
        description: "要翻译的文本内容",
        required: true,
      },
      {
        name: "targetLang",
        type: "enum",
        description: "目标语言",
        required: true,
        enumValues: ["英文", "中文", "日文", "法文", "韩文", "西班牙文"],
      },
    ],
  },
  // ... 还有 calculate、set_reminder、chitchat
];
```

**📌 关键机制：新增意图只需在这里加一条记录，无需修改其他代码。**  
系统会自动：
- 在 Prompt 中包含新意图的描述和示例
- 在解析时识别新意图名称
- 在槽位补全时处理新意图的参数

### 3.3 辅助函数

```typescript
// 根据名称查找意图定义
export function findIntent(name: string): IntentDef | undefined {
  return INTENT_REGISTRY.find((i) => i.name === name);
}

// 获取所有意图名称（用于校验 LLM 输出）
export function getIntentNames(): string[] {
  return INTENT_REGISTRY.map((i) => i.name);
}
```

---

## 4. Prompt 工程

> 文件：`src/prompt.ts`  
> 对应 LangChain 中的：PromptTemplate + OutputParser 的 format_instructions

Prompt 工程是整个系统最核心的部分。它决定了 LLM 能否准确识别意图、提取槽位。

### 4.1 System Prompt 的组成

System Prompt 由三部分拼接而成：

```
┌──────────────────────────────────────┐
│ 1. 角色定义 + 任务描述                │
│    "你是一个意图识别助手..."           │
├──────────────────────────────────────┤
│ 2. 意图列表（从注册表自动生成）       │
│    query_weather: 查询天气            │
│      参数: city(string, 必填)...     │
│      示例: "北京天气怎么样"           │
├──────────────────────────────────────┤
│ 3. 输出格式 + 规则 + Few-shot 样例   │
│    必须输出 JSON...                   │
│    示例 1: 用户说"..." → 输出 {...}  │
└──────────────────────────────────────┘
```

### 4.2 意图描述自动生成

```typescript
function buildIntentDescriptions(intents: IntentDef[]): string {
  return intents
    .map((intent) => {
      // 1. 生成槽位描述
      const slotsDesc = intent.slots.length > 0
        ? intent.slots.map((s) => {
            let desc = `    - ${s.name} (${s.type}${s.required ? ", 必填" : ", 可选"}): ${s.description}`;
            if (s.enumValues) {
              desc += ` [可选值: ${s.enumValues.join(", ")}]`;
            }
            if (s.defaultValue !== undefined) {
              desc += ` [默认: ${String(s.defaultValue)}]`;
            }
            return desc;
          }).join("\n")
        : "    （无参数）";

      // 2. 生成示例用户输入
      const examplesDesc = intent.examples
        .map((e) => `    - "${e}"`)
        .join("\n");

      // 3. 拼接为完整的意图描述
      return `  ${intent.name}: ${intent.description}\n  参数:\n${slotsDesc}\n  示例用户输入:\n${examplesDesc}`;
    })
    .join("\n\n");
}
```

**原理解释：**
- 这个函数遍历 `INTENT_REGISTRY` 中的所有意图
- 为每个意图生成一段结构化文本，包含名称、描述、参数列表和示例
- 生成的文本会被嵌入到 System Prompt 中，让 LLM 知道有哪些意图可选

例如，生成的描述可能长这样：

```
  query_weather: 查询某个城市的天气
  参数:
    - city (string, 必填): 要查询天气的城市名称
    - date (string, 可选): 查询日期 [默认: 今天]
  示例用户输入:
    - "北京今天天气怎么样？"
    - "上海明天会下雨吗？"
```

### 4.3 Few-shot 样例

Few-shot 是让 LLM 理解输出格式最有效的方法：

```typescript
const FEW_SHOT_EXAMPLES = `
示例 1:
用户: "北京明天天气怎么样？"
输出:
\`\`\`json
{
  "intent": "query_weather",
  "confidence": 0.95,
  "slots": { "city": "北京", "date": "明天" },
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
`.trim();
```

**设计技巧：**
- 示例覆盖了不同场景：全部槽位齐全、部分缺失、闲聊
- 示例 2 展示了 `missing_slots` 不为空的情况，教会 LLM 判断缺失参数
- 使用 ` ```json ``` ` 代码块包裹输出，确保 LLM 输出格式一致

### 4.4 完整 System Prompt 构建

```typescript
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
  "slots": { "参数名": "参数值" },
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
```

### 4.5 追问 Prompt（槽位补全场景）

当发现有缺失的必填槽位时，系统需要生成追问。这里有两个相关 Prompt：

```typescript
// 1. 生成友好追问 — 告诉 LLM 缺什么，让它自然地向用户提问
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

请用简洁友好的中文，向用户提出追问以获取缺失信息。`;
}

// 2. 从用户回答中提取槽位 — 告诉 LLM 当前状态和需要提取的参数
export function buildSlotExtractionPrompt(
  intentDef: IntentDef,
  existingSlots: Record<string, unknown>,
  missingSlots: string[],
): string {
  return `用户正在执行「${intentDef.description}」意图。

已知参数：
${JSON.stringify(existingSlots, null, 2)}

需要从用户最新回复中提取以下参数：
${slotDescriptions}

请严格以 JSON 格式输出提取到的参数...`;
}
```

---

## 5. LLM 调用封装

> 文件：`src/llm.ts`  
> 对应 LangChain 中的：ChatModel（如 ChatOpenAI）

### 5.1 客户端管理

```typescript
import OpenAI from "openai";

// 单例客户端（复用连接）
let _client: OpenAI | null = null;

function getClient(apiKey?: string, baseUrl?: string): OpenAI {
  // 如果提供了自定义参数，创建新实例
  if (apiKey || baseUrl) {
    return new OpenAI({
      apiKey: apiKey || config.openaiApiKey,
      baseURL: baseUrl || config.openaiBaseUrl,
    });
  }
  // 否则复用单例
  if (!_client) {
    _client = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl,
    });
  }
  return _client;
}
```

**设计思路：**
- 使用**单例模式**复用默认客户端，避免每次调用都创建连接
- 支持**运行时切换**不同的 API Key 和 Base URL（比如从前端传入）
- 兼容 DeepSeek、Moonshot 等 OpenAI 兼容的 API

### 5.2 模型自动推断

```typescript
function inferModel(baseUrl: string): string {
  const url = baseUrl.toLowerCase();
  if (url.includes("deepseek")) return "deepseek-chat";
  if (url.includes("moonshot")) return "moonshot-v1-8k";
  if (url.includes("bigmodel.cn")) return "glm-4-flash";
  return "gpt-4o-mini";
}
```

**为什么需要这个？** 用户可能只配置了 `baseUrl` 而忘记指定模型名，系统会根据 URL 自动推断合适的模型。

### 5.3 核心调用函数

```typescript
export async function callLLM(
  messages: ChatCompletionMessageParam[],
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  const client = getClient(options.apiKey, options.baseUrl);
  const model = options.model || inferModel(options.baseUrl || config.openaiBaseUrl);

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.1,  // ← 关键：意图识别用低温度！
    max_tokens: options.maxTokens ?? 1024,
  });

  const choice = response.choices[0];
  const content = choice?.message?.content || "";
  const usage = response.usage ? {
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    totalTokens: response.usage.total_tokens,
  } : undefined;

  return { content, usage };
}
```

**关键参数解释：**
- **`temperature: 0.1`** — 意图识别是一个**确定性任务**，需要尽量减少随机性。低温度让模型更倾向于选择最可能的输出
- **`max_tokens: 1024`** — JSON 输出不需要太多 token，限制输出长度
- **`usage`** — 返回 token 消耗信息，方便监控成本

### 5.4 便捷函数

```typescript
// 单轮对话 — 最常用的方式
export async function chat(
  systemPrompt: string,
  userMessage: string,
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  return callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ], options);
}

// 多轮对话 — 槽位补全场景使用
export async function chatWithHistory(
  systemPrompt: string,
  history: ChatCompletionMessageParam[],
  userMessage: string,
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  return callLLM([
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ], options);
}
```

---

## 6. 输出解析器

> 文件：`src/parser.ts`  
> 对应 LangChain 中的：OutputParser（如 JsonOutputParser）

LLM 的输出是纯文本，我们需要从中提取结构化的 JSON 数据。

### 6.1 JSON 提取

```typescript
function extractJSON(text: string): string | null {
  // 策略 1: 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // 策略 2: 尝试直接提取 {...} 块
  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (jsonMatch?.[0]) {
    return jsonMatch[0].trim();
  }

  return null;
}
```

**为什么需要两种提取策略？**
- **策略 1**：LLM 通常会按 Prompt 要求用 ` ```json ``` ` 包裹输出
- **策略 2**：某些情况下 LLM 可能直接输出 `{...}`，不加代码块标记
- 两种策略互补，提高了鲁棒性

### 6.2 意图解析与校验

```typescript
export function parseIntentResult(llmOutput: string): ParsedIntent {
  const jsonStr = extractJSON(llmOutput);

  if (!jsonStr) {
    // ⚠️ Fallback: LLM 没返回有效 JSON，默认为闲聊
    return {
      intent: "chitchat",
      confidence: 0.5,
      slots: {},
      missingSlots: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // 🔍 校验 1: intent 必须是合法的意图名称
    const intent = typeof parsed.intent === "string" ? parsed.intent : "chitchat";
    const validIntents = getIntentNames();
    const finalIntent = validIntents.includes(intent) ? intent : "chitchat";

    // 🔍 校验 2: confidence 必须是 0~1 之间的数字
    const rawConfidence = Number(parsed.confidence);
    const confidence =
      !isNaN(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
        ? rawConfidence
        : 0.5;

    // 🔍 校验 3: slots 必须是对象
    const slots = typeof parsed.slots === "object" && parsed.slots !== null
      ? parsed.slots
      : {};

    // 🔍 校验 4: missing_slots 必须是字符串数组
    const missingSlots = Array.isArray(parsed.missing_slots)
      ? parsed.missing_slots.filter((s): s is string => typeof s === "string")
      : [];

    return { intent: finalIntent, confidence, slots, missingSlots };
  } catch {
    // JSON 解析失败，fallback 到闲聊
    return { intent: "chitchat", confidence: 0.3, slots: {}, missingSlots: [] };
  }
}
```

**防御性编程的体现：**

| 异常场景 | 处理策略 |
|---------|---------|
| LLM 没返回 JSON | fallback 到 `chitchat`，置信度 0.5 |
| JSON 解析失败 | fallback 到 `chitchat`，置信度 0.3（更低） |
| intent 不在注册表中 | 强制改为 `chitchat` |
| confidence 不是合法数字 | 默认 0.5 |
| slots 不是对象 | 默认空对象 |
| missing_slots 不是数组 | 默认空数组 |

**为什么每一层都有 fallback？** 因为 LLM 的输出不可预测，即使 Prompt 写得再严格，也可能偶尔返回格式不符的内容。防御性解析确保系统永远不会崩溃。

### 6.3 槽位补全解析

```typescript
export function parseSlotExtraction(llmOutput: string): SlotExtractionResult {
  const jsonStr = extractJSON(llmOutput);

  if (!jsonStr) {
    return { extractedSlots: {} };
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const extractedSlots =
      typeof parsed.extracted_slots === "object" && parsed.extracted_slots !== null
        ? parsed.extracted_slots
        : {};
    return { extractedSlots };
  } catch {
    return { extractedSlots: {} };
  }
}
```

---

## 7. 多轮槽位补全

> 文件：`src/slot-filler.ts`  
> 对应 LangChain 中的：Agent + Memory

当用户说"帮我翻译一下"时，系统识别出意图是 `translate_text`，但缺少 `text` 和 `targetLang` 两个必填参数。这时需要进入多轮对话来补全槽位。

### 7.1 Session 管理

```typescript
export interface SlotFillingSession {
  sessionId: string;           // 会话唯一标识
  intentName: string;          // 识别出的意图
  intentDef: IntentDef;        // 意图定义（方便查询槽位信息）
  filledSlots: Record<string, unknown>;   // 已收集的槽位值
  missingSlots: string[];      // 仍然缺失的必填槽位名称
  isComplete: boolean;         // 是否已完成
  conversationHistory: Array<{ role: "assistant" | "user"; content: string }>;
}

// 内存存储（生产环境应该用 Redis）
const sessions = new Map<string, SlotFillingSession>();
```

**会话状态机：**

```
                    ┌───────────┐
                    │  创建会话  │
                    └─────┬─────┘
                          │
                          ▼
                ┌─────────────────┐
          ┌────▶│  生成追问        │
          │     └────────┬────────┘
          │              │ 追问发给用户
          │              ▼
          │     ┌─────────────────┐
          │     │  等待用户回答    │
          │     └────────┬────────┘
          │              │ 用户回答
          │              ▼
          │     ┌─────────────────┐
          │     │  提取新槽位      │
          │     └────────┬────────┘
          │              │
          │         还有缺失？
          │        /          \
          │      YES          NO
          └──────┘            │
                              ▼
                     ┌────────────────┐
                     │  执行工具 & 销  │
                     │  毁会话        │
                     └────────────────┘
```

### 7.2 创建会话

```typescript
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
    filledSlots: { ...initialSlots },     // 复制已有的槽位
    missingSlots: [...missingSlots],       // 复制缺失列表
    isComplete: missingSlots.length === 0,
    conversationHistory: [],
  };

  sessions.set(sessionId, session);
  return session;
}
```

### 7.3 生成追问

```typescript
export async function generateFollowUp(
  session: SlotFillingSession,
  options: LLMCallOptions = {},
): Promise<string> {
  // 构建追问 Prompt（告诉 LLM 缺什么信息）
  const prompt = buildSlotFillingPrompt(
    session.intentName,
    session.missingSlots,
    session.intentDef,
  );

  // 调用 LLM 生成自然语言追问
  const result = await chat(prompt, "请生成追问", options);
  const followUp = result.content.trim();

  // 记录到对话历史
  session.conversationHistory.push({
    role: "assistant",
    content: followUp,
  });

  return followUp;
}
```

**示例：** 当缺失 `text` 和 `targetLang` 时，LLM 可能生成：

> "请问你想翻译什么内容？另外，你希望翻译成哪种语言呢？（可选：英文、中文、日文、法文、韩文、西班牙文）"

### 7.4 处理用户回答

```typescript
export async function processUserReply(
  session: SlotFillingSession,
  userReply: string,
  options: LLMCallOptions = {},
): Promise<{
  newSlots: Record<string, unknown>;
  stillMissing: string[];
  isComplete: boolean;
}> {
  // 1. 记录用户回复到对话历史
  session.conversationHistory.push({
    role: "user",
    content: userReply,
  });

  // 2. 构建槽位提取 Prompt
  const extractionPrompt = buildSlotExtractionPrompt(
    session.intentDef,
    session.filledSlots,
    session.missingSlots,
  );

  // 3. 调用 LLM 从用户回答中提取新的槽位值
  const result = await chat(extractionPrompt, userReply, options);
  const { extractedSlots } = parseSlotExtraction(result.content);

  // 4. 合并新提取的槽位到已有槽位
  const newSlots: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extractedSlots)) {
    if (session.missingSlots.includes(key) && value !== undefined && value !== "") {
      session.filledSlots[key] = value;
      newSlots[key] = value;
    }
  }

  // 5. 重新计算缺失槽位
  session.missingSlots = session.intentDef.slots
    .filter((s) => s.required && session.filledSlots[s.name] === undefined)
    .map((s) => s.name);

  session.isComplete = session.missingSlots.length === 0;

  // 6. 如果全部填满，应用默认值（给可选槽位）
  if (session.isComplete) {
    for (const slot of session.intentDef.slots) {
      if (slot.defaultValue !== undefined && session.filledSlots[slot.name] === undefined) {
        session.filledSlots[slot.name] = slot.defaultValue;
      }
    }
  }

  return { newSlots, stillMissing: session.missingSlots, isComplete: session.isComplete };
}
```

**多轮对话示例：**

```
第 1 轮:
  用户: "帮我翻译一下"
  系统: intent=translate_text, missing=[text, targetLang]
  追问: "请问你想翻译什么内容？希望翻译成哪种语言？"

第 2 轮:
  用户: "你好，翻译成日文"
  系统: 提取到 text=你好, targetLang=日文
  所有槽位齐全 → 执行翻译
  结果: "こんにちは"
```

---

## 8. 工具分发器

> 文件：`src/dispatcher.ts`  
> 对应 LangChain 中的：Agent 执行 Tool

### 8.1 Handler 注册机制

```typescript
// Handler 类型定义
type IntentHandler = (
  slots: Record<string, unknown>,
) => Promise<DispatchResult> | DispatchResult;

// Handler 注册表
const handlers = new Map<string, IntentHandler>();

// 注册函数
export function registerHandler(intentName: string, handler: IntentHandler): void {
  handlers.set(intentName, handler);
}
```

### 8.2 分发执行

```typescript
export async function dispatch(
  intentName: string,
  slots: Record<string, unknown>,
): Promise<DispatchResult> {
  const handler = handlers.get(intentName);

  if (!handler) {
    return {
      success: false,
      intent: intentName,
      slots,
      result: null,
      message: `没有找到意图 "${intentName}" 的处理器`,
    };
  }

  try {
    return await handler(slots);
  } catch (error) {
    return {
      success: false,
      intent: intentName,
      slots,
      result: null,
      message: `执行失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
```

### 8.3 内置 Handler 示例

以天气查询为例：

```typescript
registerHandler("query_weather", (slots) => {
  const city = String(slots.city || "未知城市");
  const date = String(slots.date || "今天");

  // 模拟天气数据（实际项目中接天气 API）
  const weathers = ["晴", "多云", "小雨", "阴", "大风"];
  const temps = [
    { low: 5, high: 15 },
    { low: 10, high: 22 },
    // ...
  ];

  const idx = Math.abs(hashCode(city + date)) % weathers.length;

  return {
    success: true,
    intent: "query_weather",
    slots,
    result: {
      city, date,
      weather: weathers[idx],
      temperature: `${temps[idx].low}°C ~ ${temps[idx].high}°C`,
    },
    message: `${city}${date}天气：${weathers[idx]}，温度 ...`,
  };
});
```

**扩展方式：** 要添加新的工具执行逻辑，只需调用 `registerHandler("意图名", handler)`。

---

## 9. 完整流程串联

> 文件：`src/index.ts`  
> 这里是所有模块的调用入口

### 9.1 单轮意图识别 `/api/intent/recognize`

```typescript
app.post("/api/intent/recognize", async (request) => {
  const { message, model, apiKey, baseUrl, autoDispatch = true } = request.body;

  // Step 1: 构建 System Prompt
  const systemPrompt = buildSystemPrompt();

  // Step 2: 调用 LLM 进行意图识别
  const llmResult = await chat(systemPrompt, message, { model, apiKey, baseUrl });

  // Step 3: 解析 LLM 输出
  const parsed = parseIntentResult(llmResult.content);

  // Step 4: 检查是否有缺失槽位
  if (parsed.missingSlots.length > 0) {
    // 创建补全会话，生成追问
    const sessionId = `session_${Date.now()}_...`;
    const session = createSession(sessionId, parsed.intent, parsed.slots, parsed.missingSlots);
    const followUp = await generateFollowUp(session, { model, apiKey, baseUrl });

    return {
      status: "need_more_info",    // ← 告诉前端：需要更多信息
      intent: parsed.intent,
      sessionId,                   // ← 前端用这个 ID 进行后续对话
      followUp,                    // ← 追问文本
      ...
    };
  }

  // Step 5: 闲聊特殊处理
  if (parsed.intent === "chitchat") {
    const chitchatResult = await chat("你是一个友好的中文助手。", message, options);
    return { status: "completed", result: { reply: chitchatResult.content }, ... };
  }

  // Step 6: 自动分发执行工具
  if (autoDispatch) {
    const dispatchResult = await dispatch(parsed.intent, parsed.slots);
    return { status: "completed", result: dispatchResult, ... };
  }

  return { status: "ready", ... };
});
```

### 9.2 多轮槽位补全 `/api/intent/fill-slot`

```typescript
app.post("/api/intent/fill-slot", async (request) => {
  const { sessionId, message, model, apiKey, baseUrl } = request.body;

  // 获取已有会话
  const session = getSession(sessionId);
  if (!session) return { error: `Session not found: ${sessionId}` };

  // Step 1: 处理用户回答，提取新槽位
  const fillResult = await processUserReply(session, message, { model, apiKey, baseUrl });

  // Step 2: 如果还有缺失，继续追问
  if (!fillResult.isComplete) {
    const followUp = await generateFollowUp(session, { model, apiKey, baseUrl });
    return { status: "need_more_info", followUp, ... };
  }

  // Step 3: 槽位全部填满，执行工具
  const dispatchResult = await dispatch(session.intentName, session.filledSlots);
  deleteSession(sessionId);  // ← 清理会话

  return { status: "completed", result: dispatchResult, ... };
});
```

### 9.3 API 返回状态说明

| `status` | 含义 | 前端行为 |
|----------|------|---------|
| `completed` | 意图识别 + 执行完成 | 显示执行结果 |
| `need_more_info` | 有缺失槽位，需要追问 | 显示追问，等待用户输入 |
| `ready` | 意图已识别但未执行（`autoDispatch=false`） | 前端自行决定是否执行 |

---

## 10. 与 LangChain 对比

| 功能 | LangChain 方式 | 手动实现 |
|------|---------------|---------|
| 意图/工具定义 | `@tool` 装饰器 + Zod schema | `IntentDef` + `SlotDef` 接口 |
| Prompt 构建 | `ChatPromptTemplate` | `buildSystemPrompt()` 字符串拼接 |
| Few-shot | `FewShotPromptTemplate` | 硬编码在 Prompt 中 |
| LLM 调用 | `ChatOpenAI.invoke()` | `openai.chat.completions.create()` |
| 输出解析 | `JsonOutputParser` | `parseIntentResult()` 正则 + JSON.parse |
| 记忆/会话 | `BufferMemory` | `Map<string, Session>` |
| 工具执行 | `AgentExecutor` | `dispatch()` |
| 多轮对话 | Agent loop | 手动 Session + 追问 Prompt |

### 手动实现的优势

1. **完全透明** — 每一步都清晰可见，便于调试
2. **零依赖** — 不需要 LangChain 的庞大依赖树
3. **高度可控** — 可以精确控制 Prompt、解析逻辑、错误处理
4. **性能优异** — 没有框架抽象层的开销

### 手动实现的劣势

1. **代码量更多** — 需要自己处理很多边界情况
2. **无生态** — 不能直接复用 LangChain 的 Tool/Memory 插件
3. **维护成本** — Prompt 模板管理、输出格式变更都需要手动调整

---

## 11. 扩展指南

### 11.1 添加新意图

只需两步：

**第一步：** 在 `src/intents.ts` 的 `INTENT_REGISTRY` 中添加意图定义：

```typescript
{
  name: "search_music",
  description: "搜索歌曲",
  examples: ["帮我找一首周杰伦的歌", "播放稻香"],
  slots: [
    {
      name: "keyword",
      type: "string",
      description: "歌曲或歌手名称",
      required: true,
    },
    {
      name: "platform",
      type: "enum",
      description: "播放平台",
      required: false,
      enumValues: ["网易云", "QQ音乐", "Spotify"],
      defaultValue: "网易云",
    },
  ],
}
```

**第二步：** 在 `src/dispatcher.ts` 中注册 Handler：

```typescript
registerHandler("search_music", async (slots) => {
  const keyword = String(slots.keyword);
  const platform = String(slots.platform || "网易云");

  // 实际调用音乐搜索 API
  const results = await searchMusicAPI(keyword, platform);

  return {
    success: true,
    intent: "search_music",
    slots,
    result: results,
    message: `在${platform}上找到了关于"${keyword}"的歌曲`,
  };
});
```

### 11.2 生产环境改进建议

| 改进点 | 说明 |
|-------|------|
| Session 持久化 | 用 Redis 替代内存 Map，支持重启不丢失 |
| 意图分类缓存 | 对相似输入做缓存，减少 LLM 调用 |
| Prompt 版本管理 | 将 Prompt 模板外置到配置文件，支持 A/B 测试 |
| 多模型投票 | 用多个模型投票，提高意图识别准确率 |
| 日志追踪 | 记录每次 LLM 调用的输入输出，便于调试 |
| 槽位校验 | 对提取的槽位值做更严格的类型校验 |
| 并发控制 | 限制同时进行的 LLM 调用数量 |

---

## 总结

这个意图识别系统展示了如何**不依赖任何框架**，从零手写一个完整的 NLU 管线：

```
用户输入 → Prompt 构建 → LLM 调用 → 输出解析 → 槽位检查 → 多轮补全 → 工具执行
```

核心思想是：**用 LLM 替代传统的 NLU 模型，用 Prompt 工程替代训练数据，用结构化 JSON 输出替代实体提取模型。**

理解了这套流程，你也就理解了 LangChain Agent 在底层做的事情 — 只不过 LangChain 帮你把这些步骤封装成了 chain 和 agent。
