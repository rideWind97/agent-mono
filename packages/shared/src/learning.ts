/** LCEL 城市天气链 — 请求 / 响应 */
export interface CityWeatherRequest {
  city: string;
}

export interface CityWeatherResult {
  city: string;
  weather: string;
  tip: string;
}

export interface CityWeatherResponse {
  result: CityWeatherResult;
  /** LCEL 管道步骤，便于前端展示数据流 */
  pipeline: ["PromptTemplate", "ChatModel", "OutputParser"];
}

/** Memory 多轮对话 */
export interface MemoryChatRequest {
  sessionId: string;
  message: string;
}

export interface MemoryChatResponse {
  reply: string;
  sessionId: string;
  /** 当前 session 消息条数（含本轮） */
  messageCount: number;
}

export interface MemoryResetRequest {
  sessionId: string;
}

export interface MemoryResetResponse {
  ok: boolean;
  sessionId: string;
}

/** LangGraph 工作流示例 */
export interface WorkflowStep {
  node: string;
  detail: string;
}

export interface LangGraphWorkflowRequest {
  input: string;
}

export interface LangGraphWorkflowResponse {
  input: string;
  classification: "math" | "chat";
  plan: string;
  result: string;
  steps: WorkflowStep[];
}

export interface LangGraphRouterRequest {
  input: string;
}

export interface LangGraphRouterResponse {
  input: string;
  classification: "math" | "chat";
  answer: string;
  steps: WorkflowStep[];
}

/** Function Calling 天气对比 Agent */
export interface WeatherCompareRequest {
  question: string;
}

export type WeatherFlowEvent =
  | {
      type: "tool_start";
      id: string;
      name: string;
      detail: string;
      attempt: number;
    }
  | {
      type: "tool_end";
      id: string;
      name: string;
      detail: string;
      result: unknown;
      attempt: number;
    }
  | {
      type: "error";
      id: string;
      name: string;
      detail: string;
      attempt: number;
    }
  | {
      type: "token";
      content: string;
    };

export interface WeatherToolCallTrace {
  id: string;
  name: "get_weather" | "get_current_time" | "get_clothing_advice";
  args: Record<string, unknown>;
  status: "success" | "failed";
  attempts: number;
  result?: unknown;
  error?: string;
}

export interface WeatherInfo {
  city: string;
  date: string;
  condition: string;
  temperature: number;
  humidity: number;
  wind: string;
}

export interface CityWeatherCompareResult {
  city: string;
  weather?: WeatherInfo;
  currentTime?: string;
}

export interface WeatherCompareResponse {
  answer: string;
  cities: CityWeatherCompareResult[];
  tempDiff: number | null;
  advice: string;
  flow: WeatherFlowEvent[];
  toolCalls: WeatherToolCallTrace[];
}
