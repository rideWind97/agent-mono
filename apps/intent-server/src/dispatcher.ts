/**
 * 工具分发器 — 根据意图名称执行对应的逻辑
 *
 * 这就是 LangChain Agent 执行 Tool 的部分
 * 手动实现就是一个 intent -> handler 的映射
 */

// ─── 执行结果类型 ─────────────────────────────────────────
export interface DispatchResult {
  success: boolean;
  intent: string;
  slots: Record<string, unknown>;
  result: unknown;
  message: string;
}

// ─── Handler 类型 ─────────────────────────────────────────
type IntentHandler = (
  slots: Record<string, unknown>,
) => Promise<DispatchResult> | DispatchResult;

// ─── Handler 注册表 ──────────────────────────────────────
const handlers = new Map<string, IntentHandler>();

// ─── 注册 Handler ────────────────────────────────────────
export function registerHandler(
  intentName: string,
  handler: IntentHandler,
): void {
  handlers.set(intentName, handler);
}

// ─── 分发执行 ─────────────────────────────────────────────
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

// ─── 内置 Handler 注册 ───────────────────────────────────

// 1. 天气查询 — 模拟实现
registerHandler("query_weather", (slots) => {
  const city = String(slots.city || "未知城市");
  const date = String(slots.date || "今天");

  // 模拟天气数据
  const weathers = ["晴", "多云", "小雨", "阴", "大风"];
  const temps = [
    { low: 5, high: 15 },
    { low: 10, high: 22 },
    { low: 15, high: 28 },
    { low: 20, high: 35 },
    { low: -5, high: 3 },
  ];

  const idx = Math.abs(hashCode(city + date)) % weathers.length;
  const weather = weathers[idx]!;
  const temp = temps[idx]!;

  return {
    success: true,
    intent: "query_weather",
    slots,
    result: {
      city,
      date,
      weather,
      temperature: `${temp.low}°C ~ ${temp.high}°C`,
      humidity: `${40 + (idx * 10)}%`,
    },
    message: `${city}${date}天气：${weather}，温度 ${temp.low}°C ~ ${temp.high}°C`,
  };
});

// 2. 翻译 — 模拟实现
registerHandler("translate_text", (slots) => {
  const text = String(slots.text || "");
  const targetLang = String(slots.targetLang || "英文");

  // 简单的翻译模拟（实际项目中接翻译 API）
  const translations: Record<string, Record<string, string>> = {
    你好: { 英文: "Hello", 日文: "こんにちは", 法文: "Bonjour", 韩文: "안녕하세요" },
    谢谢: { 英文: "Thank you", 日文: "ありがとう", 法文: "Merci", 韩文: "감사합니다" },
  };

  const translated = translations[text]?.[targetLang] || `[${targetLang} 翻译] ${text}`;

  return {
    success: true,
    intent: "translate_text",
    slots,
    result: { original: text, translated, targetLang },
    message: `翻译结果：${translated}`,
  };
});

// 3. 计算
registerHandler("calculate", (slots) => {
  const expression = String(slots.expression || "");

  try {
    // 安全地计算数学表达式（只允许数字和运算符）
    const sanitized = expression.replace(/[^0-9+\-*/.()%^sqrt\s]/g, "");
    // 使用 Function 构造器来安全计算
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const result = new Function(`return (${sanitized})`)() as number;

    return {
      success: true,
      intent: "calculate",
      slots,
      result: { expression, answer: result },
      message: `${expression} = ${result}`,
    };
  } catch {
    return {
      success: false,
      intent: "calculate",
      slots,
      result: null,
      message: `无法计算表达式: ${expression}`,
    };
  }
});

// 4. 设置提醒 — 模拟实现
registerHandler("set_reminder", (slots) => {
  const content = String(slots.content || "");
  const time = String(slots.time || "");

  return {
    success: true,
    intent: "set_reminder",
    slots,
    result: {
      id: `reminder_${Date.now()}`,
      content,
      time,
      createdAt: new Date().toISOString(),
    },
    message: `已设置提醒：${time} — ${content}`,
  };
});

// 5. 闲聊 — 直接返回（实际由 LLM 生成回复）
registerHandler("chitchat", (slots) => {
  return {
    success: true,
    intent: "chitchat",
    slots,
    result: { type: "chitchat" },
    message: "这是一个闲聊意图，将由 LLM 直接回复",
  };
});

// ─── 辅助：字符串 hash ──────────────────────────────────
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
