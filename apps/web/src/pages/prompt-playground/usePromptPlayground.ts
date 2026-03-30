import { useState, useRef, useCallback } from "react";
import type { Provider, Message, PromptStrategy } from "./types";
import { STRATEGY_PRESETS, COMPARISON_STRATEGIES } from "./types";

/** 单个策略的运行结果 */
export interface RunResult {
  strategyName: string;
  output: string;
  isLoading: boolean;
  error: string | null;
  /** 耗时（毫秒） */
  duration: number | null;
}

export function usePromptPlayground() {
  // ---- Provider / API 设置（复用 chat 页面的 localStorage） ----
  const [provider, setProvider] = useState<Provider>(() => {
    return (localStorage.getItem("ai_provider") as Provider) || "gemini";
  });
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem("openai_api_key") || "";
  });
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [baseUrl, setBaseUrl] = useState(() => {
    return (
      localStorage.getItem("openai_base_url") || "https://api.openai.com/v1"
    );
  });
  const [model, setModel] = useState(() => {
    return localStorage.getItem("openai_model") || "gpt-4o-mini";
  });
  const [geminiModel, setGeminiModel] = useState(() => {
    return localStorage.getItem("gemini_model") || "gemini-3-flash-preview";
  });

  // ---- Playground 状态 ----
  const [activeStrategy, setActiveStrategy] =
    useState<PromptStrategy>("code-review");
  const [userInput, setUserInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    STRATEGY_PRESETS["code-review"].systemPrompt,
  );
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ---- 对比模式状态 ----
  const [comparisonResults, setComparisonResults] = useState<RunResult[]>([]);

  const abortControllersRef = useRef<AbortController[]>([]);

  const currentApiKey = provider === "gemini" ? geminiApiKey : apiKey;
  const currentModel = provider === "gemini" ? geminiModel : model;

  /** 切换策略时更新 system prompt */
  const switchStrategy = useCallback((strategy: PromptStrategy) => {
    setActiveStrategy(strategy);
    setSystemPrompt(STRATEGY_PRESETS[strategy].systemPrompt);
    setOutput("");
    setUserInput("");
    setComparisonResults([]);
  }, []);

  /** 构建完整的消息列表 */
  const buildMessages = useCallback(
    (
      sysPrompt: string,
      input: string,
      fewShotMsgs?: Message[],
    ): Message[] => {
      const messages: Message[] = [{ role: "system", content: sysPrompt }];
      if (fewShotMsgs && fewShotMsgs.length > 0) {
        messages.push(...fewShotMsgs);
      }
      messages.push({ role: "user", content: input });
      return messages;
    },
    [],
  );

  /** 调用 API 并流式读取 */
  const callAPI = useCallback(
    async (
      messages: Message[],
      signal: AbortSignal,
      onChunk: (text: string) => void,
    ): Promise<void> => {
      const endpoint = provider === "gemini" ? "/api/gemini" : "/api/chat";
      const body =
        provider === "gemini"
          ? {
              messages,
              model: geminiModel,
              apiKey: geminiApiKey,
              temperature: 0.7,
              maxTokens: 2048,
            }
          : {
              messages,
              model,
              apiKey,
              baseUrl,
              temperature: 0.7,
              maxTokens: 2048,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `API 请求失败 (${response.status})`,
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("无法读取响应流");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
          const data = trimmedLine.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) onChunk(delta);
          } catch (e) {
            if (
              e instanceof Error &&
              e.message !== "Unexpected end of JSON input"
            ) {
              throw e;
            }
          }
        }
      }
    },
    [provider, geminiModel, geminiApiKey, model, apiKey, baseUrl],
  );

  /** 运行当前策略 */
  const runStrategy = useCallback(async () => {
    const trimmed = userInput.trim();
    if (!trimmed || isLoading) return;

    if (!currentApiKey) {
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    setOutput("");

    const preset = STRATEGY_PRESETS[activeStrategy];
    const messages = buildMessages(
      systemPrompt,
      trimmed,
      preset.fewShotMessages,
    );

    const abortController = new AbortController();
    abortControllersRef.current = [abortController];

    let accumulated = "";
    try {
      await callAPI(messages, abortController.signal, (chunk) => {
        accumulated += chunk;
        setOutput(accumulated);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      setOutput(`❌ 错误: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    userInput,
    isLoading,
    currentApiKey,
    activeStrategy,
    systemPrompt,
    buildMessages,
    callAPI,
  ]);

  /** 运行对比实验（同时调用三种策略） */
  const runComparison = useCallback(async () => {
    const trimmed = userInput.trim();
    if (!trimmed) return;

    if (!currentApiKey) {
      setShowSettings(true);
      return;
    }

    // 初始化三个结果
    const initialResults: RunResult[] = COMPARISON_STRATEGIES.map((s) => ({
      strategyName: s.name,
      output: "",
      isLoading: true,
      error: null,
      duration: null,
    }));
    setComparisonResults(initialResults);

    // 取消之前的请求
    for (const ctrl of abortControllersRef.current) {
      ctrl.abort();
    }

    const controllers: AbortController[] = [];

    // 并行发起三个请求
    const promises = COMPARISON_STRATEGIES.map(async (strategy, index) => {
      const abortController = new AbortController();
      controllers.push(abortController);

      const messages = buildMessages(
        strategy.systemPrompt,
        trimmed,
        [...strategy.fewShotMessages],
      );

      let accumulated = "";
      const startTime = Date.now();

      try {
        await callAPI(messages, abortController.signal, (chunk) => {
          accumulated += chunk;
          setComparisonResults((prev) =>
            prev.map((r, i) =>
              i === index ? { ...r, output: accumulated } : r,
            ),
          );
        });

        setComparisonResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? { ...r, isLoading: false, duration: Date.now() - startTime }
              : r,
          ),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        const errorMsg = error instanceof Error ? error.message : "未知错误";
        setComparisonResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? {
                  ...r,
                  isLoading: false,
                  error: errorMsg,
                  duration: Date.now() - startTime,
                }
              : r,
          ),
        );
      }
    });

    abortControllersRef.current = controllers;
    await Promise.allSettled(promises);
  }, [userInput, currentApiKey, buildMessages, callAPI]);

  /** 停止所有请求 */
  const stopAll = useCallback(() => {
    for (const ctrl of abortControllersRef.current) {
      ctrl.abort();
    }
    setIsLoading(false);
    setComparisonResults((prev) =>
      prev.map((r) => (r.isLoading ? { ...r, isLoading: false } : r)),
    );
  }, []);

  return {
    // provider settings
    provider,
    setProvider,
    apiKey,
    setApiKey,
    geminiApiKey,
    setGeminiApiKey,
    baseUrl,
    setBaseUrl,
    model,
    setModel,
    geminiModel,
    setGeminiModel,
    showSettings,
    setShowSettings,
    currentApiKey,
    currentModel,
    // playground state
    activeStrategy,
    switchStrategy,
    userInput,
    setUserInput,
    systemPrompt,
    setSystemPrompt,
    output,
    isLoading,
    // comparison
    comparisonResults,
    // actions
    runStrategy,
    runComparison,
    stopAll,
  };
}
