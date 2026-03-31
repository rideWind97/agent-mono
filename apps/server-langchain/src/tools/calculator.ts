import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // 安全地计算数学表达式（仅允许数字和基本运算符）
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      if (!sanitized || sanitized !== expression.replace(/\s/g, "").replace(/[^0-9+\-*/().%]/g, "")) {
        return JSON.stringify({
          error: true,
          message: `不安全的表达式: "${expression}"，仅支持数字和 +, -, *, /, (), % 运算符`,
        });
      }

      // eslint-disable-next-line no-eval
      const result = new Function(`"use strict"; return (${sanitized})`)();

      if (typeof result !== "number" || !isFinite(result)) {
        return JSON.stringify({
          error: true,
          message: `计算结果无效: ${result}`,
        });
      }

      return JSON.stringify({
        expression,
        result,
        message: `${expression} = ${result}`,
      });
    } catch (e) {
      return JSON.stringify({
        error: true,
        message: `计算出错: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  },
  {
    name: "calculator",
    description:
      "计算数学表达式。支持加减乘除和括号。Calculate a math expression. Supports +, -, *, /, (), %.",
    schema: z.object({
      expression: z.string().describe("数学表达式，如 '(2 + 3) * 4'"),
    }),
  },
);
