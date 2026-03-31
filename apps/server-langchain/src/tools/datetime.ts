import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const currentTimeTool = tool(
  async ({ timezone }) => {
    const tz = timezone || "Asia/Shanghai";
    try {
      const now = new Date();
      const formatted = now.toLocaleString("zh-CN", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "long",
      });

      return JSON.stringify({
        timezone: tz,
        datetime: formatted,
        timestamp: now.getTime(),
        message: `当前时间（${tz}）：${formatted}`,
      });
    } catch {
      return JSON.stringify({
        error: true,
        message: `无效的时区: "${tz}"`,
      });
    }
  },
  {
    name: "get_current_time",
    description:
      "获取当前日期和时间。可以指定时区。Get the current date and time, optionally for a specific timezone.",
    schema: z.object({
      timezone: z
        .string()
        .optional()
        .describe("时区，如 'Asia/Shanghai'、'America/New_York'，默认为 Asia/Shanghai"),
    }),
  },
);
