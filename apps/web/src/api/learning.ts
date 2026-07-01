import type {
  CityWeatherRequest,
  CityWeatherResponse,
  LangGraphRouterRequest,
  LangGraphRouterResponse,
  LangGraphWorkflowRequest,
  LangGraphWorkflowResponse,
  MemoryChatRequest,
  MemoryChatResponse,
  MemoryResetResponse,
  WeatherCompareRequest,
  WeatherCompareResponse,
} from "@agent-mono/shared";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error ?? `请求失败: ${res.status}`);
  }
  return data as T;
}

export function fetchCityWeather(payload: CityWeatherRequest) {
  return postJson<CityWeatherResponse>("/api/learning/lcel-city", payload);
}

export function sendMemoryChat(payload: MemoryChatRequest) {
  return postJson<MemoryChatResponse>("/api/learning/memory-chat", payload);
}

export function resetMemoryChat(sessionId: string) {
  return postJson<MemoryResetResponse>("/api/learning/memory-reset", { sessionId });
}

export function runLangGraphWorkflow(payload: LangGraphWorkflowRequest) {
  return postJson<LangGraphWorkflowResponse>("/api/learning/langgraph-workflow", payload);
}

export function runLangGraphRouter(payload: LangGraphRouterRequest) {
  return postJson<LangGraphRouterResponse>("/api/learning/langgraph-router", payload);
}

export function runWeatherAgent(payload: WeatherCompareRequest) {
  return postJson<WeatherCompareResponse>("/api/learning/weather-agent", payload);
}
