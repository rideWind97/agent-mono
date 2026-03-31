import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const translatorTool = tool(
  async ({ text, from, to }) => {
    // 简单的模拟翻译（实际项目中可接入翻译 API）
    const translations: Record<string, Record<string, string>> = {
      你好: { en: "Hello", ja: "こんにちは", ko: "안녕하세요", fr: "Bonjour" },
      谢谢: { en: "Thank you", ja: "ありがとう", ko: "감사합니다", fr: "Merci" },
      再见: { en: "Goodbye", ja: "さようなら", ko: "안녕히 가세요", fr: "Au revoir" },
      hello: { zh: "你好", ja: "こんにちは", ko: "안녕하세요", fr: "Bonjour" },
      "thank you": { zh: "谢谢", ja: "ありがとう", ko: "감사합니다", fr: "Merci" },
      goodbye: { zh: "再见", ja: "さようなら", ko: "안녕히 가세요", fr: "Au revoir" },
    };

    const key = text.toLowerCase().trim();
    const targetLang = to || "en";
    const result = translations[key]?.[targetLang];

    if (result) {
      return JSON.stringify({
        original: text,
        translated: result,
        from: from || "auto",
        to: targetLang,
        message: `翻译结果: "${text}" → "${result}" (${targetLang})`,
      });
    }

    return JSON.stringify({
      original: text,
      translated: `[Translation of "${text}" to ${targetLang}]`,
      from: from || "auto",
      to: targetLang,
      message: `模拟翻译: "${text}" → ${targetLang}（实际项目中请接入翻译 API）`,
      note: "这是模拟翻译结果，实际项目中建议接入 Google Translate 或 DeepL API",
    });
  },
  {
    name: "translate",
    description:
      "翻译文本到指定语言。Translate text to a specified language.",
    schema: z.object({
      text: z.string().describe("要翻译的文本"),
      from: z.string().optional().describe("源语言代码，如 'zh'、'en'，默认自动检测"),
      to: z.string().describe("目标语言代码，如 'en'、'zh'、'ja'、'ko'、'fr'"),
    }),
  },
);
