/**
 * 意图定义 & 槽位 Schema
 *
 * 核心设计思路：
 * 1. 每个意图 = name + description + slots（参数）
 * 2. 每个 slot 有类型、描述、是否必填、枚举值等
 * 3. 注册新意图只需要在 INTENT_REGISTRY 中添加一条，无需改动其他代码
 *
 * 这就是 LangChain 的 Tool 定义干的事，现在你手动实现了
 */

// ─── 槽位类型定义 ─────────────────────────────────────────
export interface SlotDef {
  /** 槽位名称，如 "city" */
  name: string;
  /** 槽位类型 */
  type: "string" | "number" | "boolean" | "enum";
  /** 中文描述，用于追问 */
  description: string;
  /** 是否必填 */
  required: boolean;
  /** 枚举可选值，type 为 enum 时使用 */
  enumValues?: string[];
  /** 默认值 */
  defaultValue?: string | number | boolean;
}

// ─── 意图定义 ─────────────────────────────────────────────
export interface IntentDef {
  /** 意图唯一标识，如 "query_weather" */
  name: string;
  /** 意图中文描述 */
  description: string;
  /** 触发示例（用于 few-shot prompt） */
  examples: string[];
  /** 该意图需要的槽位 */
  slots: SlotDef[];
}

// ─── 意图注册表 ─────────────────────────────────────────
// 📌 新增意图只需在这里添加一条，系统自动支持
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
        defaultValue: "今天",
      },
    ],
  },
  {
    name: "translate_text",
    description: "翻译文本到指定语言",
    examples: [
      '帮我把"你好"翻译成英文',
      "translate hello to Japanese",
      '法语怎么说"谢谢"？',
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
  {
    name: "calculate",
    description: "进行数学计算",
    examples: [
      "123 乘以 456 等于多少？",
      "帮我算一下 15% 的税",
      "1024 的平方根是多少",
    ],
    slots: [
      {
        name: "expression",
        type: "string",
        description: "数学表达式",
        required: true,
      },
    ],
  },
  {
    name: "set_reminder",
    description: "设置一个提醒/闹钟",
    examples: [
      "提醒我下午3点开会",
      "明天早上7点叫我起床",
      "帮我设个 30 分钟后的闹钟",
    ],
    slots: [
      {
        name: "content",
        type: "string",
        description: "提醒事项内容",
        required: true,
      },
      {
        name: "time",
        type: "string",
        description: '提醒时间，如"下午3点"、"30分钟后"',
        required: true,
      },
    ],
  },
  {
    name: "chitchat",
    description: "闲聊 / 通用对话（不需要调用任何工具）",
    examples: [
      "你好",
      "你是谁？",
      "讲个笑话吧",
      "今天心情不错",
    ],
    slots: [],
  },
];

// ─── 辅助函数 ─────────────────────────────────────────────
export function findIntent(name: string): IntentDef | undefined {
  return INTENT_REGISTRY.find((i) => i.name === name);
}

export function getIntentNames(): string[] {
  return INTENT_REGISTRY.map((i) => i.name);
}
