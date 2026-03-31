import { tool } from "@langchain/core/tools";
import { z } from "zod";

const allowedNamedColors = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
  "cyan",
  "magenta",
  "brown",
  "teal",
  "navy",
  "lime",
  "maroon",
  "olive",
  "silver",
  "gold",
  "transparent",
]);

function isSafeCssColor(input: string): boolean {
  const color = input.trim().toLowerCase();

  // #RGB / #RRGGBB / #RRGGBBAA
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(color)) {
    return true;
  }

  // rgb(...) / rgba(...)
  if (/^rgba?\(\s*[\d.\s,%+-]+\)$/.test(color)) {
    return true;
  }

  // hsl(...) / hsla(...)
  if (/^hsla?\(\s*[\d.\s,%+-]+\)$/.test(color)) {
    return true;
  }

  return allowedNamedColors.has(color);
}

export const setPageBackgroundColorTool = tool(
  async ({ color }) => {
    const normalized = color.trim();

    if (!isSafeCssColor(normalized)) {
      return JSON.stringify({
        success: false,
        error: true,
        action: "set_page_background_color",
        message: `不支持的颜色值: "${color}"。请使用 hex/rgb/rgba/hsl/hsla 或常见颜色名。`,
      });
    }

    // The frontend listens to tool_end events and executes this action.
    return JSON.stringify({
      success: true,
      action: "set_page_background_color",
      color: normalized,
      message: `已将网页背景色设置为 ${normalized}`,
    });
  },
  {
    name: "set_page_background_color",
    description:
      "设置当前网页背景颜色。Set the current webpage background color. Example color values: '#0ea5e9', 'rgb(30,41,59)', 'white'.",
    schema: z.object({
      color: z
        .string()
        .describe("要设置的 CSS 颜色值，如 '#0ea5e9'、'rgb(15,23,42)'、'white'"),
    }),
  },
);
