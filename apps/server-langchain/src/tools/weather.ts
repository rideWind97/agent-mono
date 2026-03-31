import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 模拟天气数据
 */
const WEATHER_DATA: Record<
  string,
  { temp: number; condition: string; humidity: number; wind: string }
> = {
  北京: { temp: 22, condition: "晴", humidity: 35, wind: "北风3级" },
  上海: { temp: 26, condition: "多云", humidity: 65, wind: "东南风2级" },
  广州: { temp: 30, condition: "雷阵雨", humidity: 80, wind: "南风2级" },
  深圳: { temp: 29, condition: "阵雨", humidity: 78, wind: "西南风3级" },
  杭州: { temp: 25, condition: "阴", humidity: 60, wind: "东风2级" },
  成都: { temp: 23, condition: "多云", humidity: 70, wind: "微风" },
  武汉: { temp: 27, condition: "晴", humidity: 50, wind: "南风2级" },
  南京: { temp: 24, condition: "多云转晴", humidity: 55, wind: "东北风2级" },
  西安: { temp: 20, condition: "晴", humidity: 30, wind: "西北风3级" },
  重庆: { temp: 28, condition: "阴", humidity: 75, wind: "微风" },
  // English city names
  beijing: { temp: 22, condition: "Sunny", humidity: 35, wind: "North 3" },
  shanghai: { temp: 26, condition: "Cloudy", humidity: 65, wind: "SE 2" },
  tokyo: { temp: 18, condition: "Rainy", humidity: 70, wind: "East 3" },
  "new york": { temp: 15, condition: "Partly Cloudy", humidity: 55, wind: "West 4" },
  london: { temp: 12, condition: "Overcast", humidity: 80, wind: "SW 3" },
  paris: { temp: 16, condition: "Sunny", humidity: 45, wind: "NW 2" },
  sydney: { temp: 20, condition: "Clear", humidity: 50, wind: "South 2" },
  "san francisco": { temp: 17, condition: "Foggy", humidity: 75, wind: "West 5" },
};

export const weatherTool = tool(
  async ({ city }) => {
    const key = city.toLowerCase().trim();
    const data = WEATHER_DATA[key] || WEATHER_DATA[city];

    if (data) {
      return JSON.stringify({
        city,
        temperature: `${data.temp}°C`,
        condition: data.condition,
        humidity: `${data.humidity}%`,
        wind: data.wind,
        message: `${city}当前天气：${data.condition}，温度 ${data.temp}°C，湿度 ${data.humidity}%，${data.wind}`,
      });
    }

    // 对于未知城市，生成随机天气
    const conditions = ["晴", "多云", "阴", "小雨", "阵雨"];
    const randomTemp = Math.floor(Math.random() * 25) + 5;
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const randomHumidity = Math.floor(Math.random() * 60) + 30;

    return JSON.stringify({
      city,
      temperature: `${randomTemp}°C`,
      condition: randomCondition,
      humidity: `${randomHumidity}%`,
      wind: "微风",
      message: `${city}当前天气：${randomCondition}，温度 ${randomTemp}°C，湿度 ${randomHumidity}%，微风`,
      note: "（模拟数据）",
    });
  },
  {
    name: "get_weather",
    description:
      "获取指定城市的天气信息。支持中文和英文城市名。Get weather information for a specified city.",
    schema: z.object({
      city: z.string().describe("城市名称，如 '北京'、'上海'、'New York'"),
    }),
  },
);
