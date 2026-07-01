import type {
  CityWeatherCompareResult,
  WeatherCompareResponse,
  WeatherFlowEvent,
  WeatherInfo,
  WeatherToolCallTrace,
} from "@agent-mono/shared";

import { serverConfig } from "../../config.js";

type ToolName = WeatherToolCallTrace["name"];

interface ToolCallPlan {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
}

// Demo 使用固定 mock 数据，避免学习 Function Calling 时被真实天气 API 的鉴权、
// 限流和网络波动干扰。这里的重点是工具定义、调用编排和错误处理。
const cityWeather: Record<string, Omit<WeatherInfo, "city" | "date">> = {
  北京: { condition: "晴", temperature: 8, humidity: 35, wind: "西北风 2 级" },
  上海: { condition: "小雨", temperature: 14, humidity: 72, wind: "东风 3 级" },
  广州: { condition: "多云", temperature: 23, humidity: 68, wind: "南风 2 级" },
  深圳: { condition: "晴", temperature: 24, humidity: 64, wind: "微风" },
  杭州: { condition: "阴", temperature: 13, humidity: 70, wind: "东北风 2 级" },
};

const cityTimeZone: Record<string, string> = {
  北京: "Asia/Shanghai",
  上海: "Asia/Shanghai",
  广州: "Asia/Shanghai",
  深圳: "Asia/Shanghai",
  杭州: "Asia/Shanghai",
};

// 指数退避重试间隔：首次失败后等 200ms，再失败等 500ms，再失败等 1000ms。
const retryDelays = [200, 500, 1000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCities(question: string) {
  const cities = Object.keys(cityWeather).filter((city) => question.includes(city));
  return cities.length >= 2 ? cities.slice(0, 2) : ["北京", "上海"];
}

// 所有工具入口都先做白名单校验，避免模型把任意文本当参数传给工具。
function assertAllowedCity(city: unknown): string {
  if (typeof city !== "string" || city.length > 20 || !(city in cityWeather)) {
    throw new Error(`不支持的城市：${String(city)}`);
  }
  return city;
}

async function getWeather(cityInput: unknown, dateInput?: unknown): Promise<WeatherInfo> {
  const city = assertAllowedCity(cityInput);
  const date = typeof dateInput === "string" && dateInput ? dateInput : "today";
  const weather = cityWeather[city];
  if (!weather) {
    throw new Error(`不支持的城市：${city}`);
  }

  return {
    city,
    date,
    ...weather,
  };
}

async function getCurrentTime(cityInput: unknown) {
  const city = assertAllowedCity(cityInput);
  const timeZone = cityTimeZone[city];

  return {
    city,
    timeZone,
    currentTime: new Intl.DateTimeFormat("zh-CN", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    }).format(new Date()),
  };
}

async function getClothingAdvice(tempDiffInput: unknown, weatherSummaryInput: unknown) {
  const tempDiff = typeof tempDiffInput === "number" ? tempDiffInput : 0;
  const weatherSummary =
    typeof weatherSummaryInput === "string" ? weatherSummaryInput : "天气信息不足";

  const diffTip =
    tempDiff >= 8
      ? "两地温差较大，出行建议采用分层穿搭。"
      : "两地温差不大，按较冷城市准备外套即可。";
  const rainTip = weatherSummary.includes("雨") ? "有降雨城市请带伞。" : "暂无明显降雨风险。";

  return {
    tempDiff,
    weatherSummary,
    advice: `${diffTip}${rainTip}`,
  };
}

function buildFallbackToolCalls(cities: string[]): ToolCallPlan[] {
  return cities.flatMap((city, index) => [
    {
      id: `fallback-weather-${index}`,
      name: "get_weather",
      args: { city, date: "today" },
    },
    {
      id: `fallback-time-${index}`,
      name: "get_current_time",
      args: { city },
    },
  ]);
}

// 第一步先让模型“决定应该调用哪些工具”。如果模型或兼容端点没有返回
// tool_calls，后面会使用 fallback 工具调用，保证教学 Demo 稳定可运行。
async function requestInitialToolCalls(question: string): Promise<ToolCallPlan[]> {
  if (!serverConfig.openaiApiKey || serverConfig.openaiApiKey === "sk-your-key-here") {
    return [];
  }

  const tools = [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "查询指定城市的今日天气。",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "城市名，仅支持北京、上海、广州、深圳、杭州" },
            date: { type: "string", description: "日期，例如 today" },
          },
          required: ["city"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_current_time",
        description: "查询指定城市当前时间。",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "城市名，仅支持北京、上海、广州、深圳、杭州" },
          },
          required: ["city"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_clothing_advice",
        description: "根据温差和天气摘要生成穿衣建议。",
        parameters: {
          type: "object",
          properties: {
            tempDiff: { type: "number", description: "两地温差绝对值" },
            weatherSummary: { type: "string", description: "天气摘要" },
          },
          required: ["tempDiff", "weatherSummary"],
          additionalProperties: false,
        },
      },
    },
  ];

  // 这里直接调用 OpenAI 兼容的 Chat Completions API，是为了显式展示
  // tools / tool_calls 消息流；没有使用 LangChain 封装，便于学习底层结构。
  const res = await fetch(`${serverConfig.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverConfig.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: serverConfig.openaiModel,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "你是天气对比 Agent。用户要求比较城市天气时，先调用 get_weather 和 get_current_time；穿衣建议可由后续工具处理。",
        },
        { role: "user", content: question },
      ],
      tools,
      tool_choice: "auto",
    }),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    choices?: {
      message?: {
        tool_calls?: {
          id: string;
          function: { name: ToolName; arguments: string };
        }[];
      };
    }[];
  };

  return (
    data.choices?.[0]?.message?.tool_calls?.map((call) => ({
      id: call.id,
      name: call.function.name,
      args: JSON.parse(call.function.arguments || "{}") as Record<string, unknown>,
    })) ?? []
  );
}

async function executeTool(
  call: ToolCallPlan,
  options: { flow: WeatherFlowEvent[]; shouldSimulateTimeout: boolean },
) {
  let attempts = 0;
  let lastError = "";

  for (let index = 0; index <= retryDelays.length; index++) {
    attempts += 1;
    // flow 是给前端看的“可观测轨迹”，让用户知道工具何时开始、成功或失败。
    options.flow.push({
      type: "tool_start",
      id: call.id,
      name: call.name,
      detail: `${call.name} 第 ${attempts} 次执行`,
      attempt: attempts,
    });

    try {
      // 在问题里加入“超时”时触发模拟失败，用于验证重试逻辑。
      if (options.shouldSimulateTimeout && attempts <= retryDelays.length) {
        throw new Error("模拟天气 API 超时");
      }

      const result =
        call.name === "get_weather"
          ? await getWeather(call.args.city, call.args.date)
          : call.name === "get_current_time"
            ? await getCurrentTime(call.args.city)
            : await getClothingAdvice(call.args.tempDiff, call.args.weatherSummary);

      options.flow.push({
        type: "tool_end",
        id: call.id,
        name: call.name,
        detail: `${call.name} 执行成功`,
        result,
        attempt: attempts,
      });

      return {
        id: call.id,
        name: call.name,
        args: call.args,
        status: "success" as const,
        attempts,
        result,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "工具执行失败";
      options.flow.push({
        type: "error",
        id: call.id,
        name: call.name,
        detail: `${call.name} 失败：${lastError}`,
        attempt: attempts,
      });

      const delay = retryDelays[index];
      if (typeof delay === "number") {
        // 单个工具失败只重试该工具，不影响同一批次里其他并行工具完成。
        await sleep(delay);
      }
    }
  }

  return {
    id: call.id,
    name: call.name,
    args: call.args,
    status: "failed" as const,
    attempts,
    error: lastError,
  };
}

// 合并模型返回的 tool_calls 与兜底调用，并按 “工具名 + 城市” 去重。
// 这样即使模型漏调某个城市的天气/时间，Demo 也能补齐核心数据。
function normalizeInitialToolCalls(question: string, modelCalls: ToolCallPlan[]) {
  const cities = parseCities(question);
  const required = buildFallbackToolCalls(cities);
  const byKey = new Map<string, ToolCallPlan>();

  for (const call of modelCalls.concat(required)) {
    if (call.name === "get_clothing_advice") continue;
    const city = typeof call.args.city === "string" ? call.args.city : "";
    const key = `${call.name}:${city}`;
    if (city in cityWeather && !byKey.has(key)) {
      byKey.set(key, call);
    }
  }

  return Array.from(byKey.values());
}

// 把扁平的工具执行结果整理成前端更容易渲染的 city 列表与温差。
function buildStructuredResult(toolCalls: WeatherToolCallTrace[]) {
  const cities = new Map<string, CityWeatherCompareResult>();

  for (const call of toolCalls) {
    if (call.status !== "success") continue;

    if (call.name === "get_weather") {
      const weather = call.result as WeatherInfo;
      const current = cities.get(weather.city) ?? { city: weather.city };
      current.weather = weather;
      cities.set(weather.city, current);
    }

    if (call.name === "get_current_time") {
      const time = call.result as { city: string; currentTime: string };
      const current = cities.get(time.city) ?? { city: time.city };
      current.currentTime = time.currentTime;
      cities.set(time.city, current);
    }
  }

  const cityList = Array.from(cities.values());
  const temperatures = cityList
    .map((city) => city.weather?.temperature)
    .filter((value): value is number => typeof value === "number");
  const [firstTemperature, secondTemperature] = temperatures;
  const tempDiff =
    typeof firstTemperature === "number" && typeof secondTemperature === "number"
      ? Math.abs(firstTemperature - secondTemperature)
      : null;

  return { cityList, tempDiff };
}

async function generateFinalAnswer(input: {
  question: string;
  cities: CityWeatherCompareResult[];
  tempDiff: number | null;
  advice: string;
}) {
  // 即使最终总结模型调用失败，也要基于工具结果给出一个可用回答。
  const fallback = [
    `已完成天气对比。`,
    ...input.cities.map((city) => {
      const weather = city.weather
        ? `${city.weather.condition}，${city.weather.temperature}°C，${city.weather.wind}`
        : "天气查询失败";
      const time = city.currentTime ? `当前时间 ${city.currentTime}` : "时间查询失败";
      return `${city.city}：${weather}，${time}`;
    }),
    input.tempDiff === null ? "温差未知。" : `两地温差 ${input.tempDiff}°C。`,
    input.advice,
  ].join("\n");

  if (!serverConfig.openaiApiKey || serverConfig.openaiApiKey === "sk-your-key-here") {
    return fallback;
  }

  // 最后再让模型基于结构化工具结果做自然语言总结。
  const res = await fetch(`${serverConfig.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverConfig.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: serverConfig.openaiModel,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "你是天气对比助手。基于工具结果，用中文简洁总结天气、时间、温差和建议。",
        },
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
      ],
    }),
  });

  if (!res.ok) return fallback;

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? fallback;
}

export async function runWeatherCompareAgent(question: string): Promise<WeatherCompareResponse> {
  const flow: WeatherFlowEvent[] = [];
  const modelCalls = await requestInitialToolCalls(question);
  const initialCalls = normalizeInitialToolCalls(question, modelCalls);
  const timeoutCity = parseCities(question)[0];
  const shouldSimulateTimeout = question.includes("超时");

  // 天气和时间查询彼此独立，因此用 Promise.all 并行执行。
  const firstBatch = await Promise.all(
    initialCalls.map((call) =>
      executeTool(call, {
        flow,
        shouldSimulateTimeout:
          shouldSimulateTimeout &&
          call.name === "get_weather" &&
          call.args.city === timeoutCity,
      }),
    ),
  );

  const { cityList, tempDiff } = buildStructuredResult(firstBatch);
  const weatherSummary = cityList
    .map((city) =>
      city.weather
        ? `${city.city}${city.weather.condition}${city.weather.temperature}°C`
        : `${city.city}天气未知`,
    )
    .join("；");

  const adviceCall: ToolCallPlan = {
    id: "local-advice",
    name: "get_clothing_advice",
    args: {
      tempDiff: tempDiff ?? 0,
      weatherSummary,
    },
  };
  // 穿衣建议依赖天气工具结果，所以放在第一批并行工具完成后执行。
  const adviceTrace = await executeTool(adviceCall, { flow, shouldSimulateTimeout: false });
  const toolCalls = firstBatch.concat(adviceTrace);
  const advice =
    adviceTrace.status === "success"
      ? (adviceTrace.result as { advice: string }).advice
      : "穿衣建议生成失败，请按较冷城市准备。";
  const answer = await generateFinalAnswer({
    question,
    cities: cityList,
    tempDiff,
    advice,
  });

  // token 事件模拟“最终回复已生成”。后续如果改成 SSE，可以把这类事件逐步推给前端。
  flow.push({ type: "token", content: answer });

  return {
    answer,
    cities: cityList,
    tempDiff,
    advice,
    flow,
    toolCalls,
  };
}
