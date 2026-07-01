import type {
  CityWeatherRequest,
  CityWeatherResponse,
  MemoryChatRequest,
  MemoryChatResponse,
  MemoryResetResponse,
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
