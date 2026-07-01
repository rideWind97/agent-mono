import type { CityWeatherResult } from "@agent-mono/shared";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";


import { createChatModel } from "../llm.js";

const cityWeatherSchema = z.object({
  city: z.string().describe("城市名称"),
  weather: z.string().describe("当前天气概况，如：晴，25°C，微风"),
  tip: z.string().describe("一句出行或穿衣建议"),
});

const parser = StructuredOutputParser.fromZodSchema(cityWeatherSchema);

const prompt = ChatPromptTemplate.fromTemplate(
  `你是天气助手。根据常识推断给定城市的典型天气（无需调用外部 API）。
{format_instructions}

城市：{city}`,
);

/** LCEL: prompt | model | parser */
export async function runCityWeatherChain(city: string): Promise<CityWeatherResult> {
  const model = createChatModel({ temperature: 0.2 });
  const chain = prompt.pipe(model).pipe(parser);

  return chain.invoke({
    city,
    format_instructions: parser.getFormatInstructions(),
  });
}
