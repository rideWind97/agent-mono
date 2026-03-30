import { useState, useRef, useEffect, useCallback } from "react";
import type { Provider, Message } from "./types";
import { SYSTEM_PROMPT, GEMINI_MODELS } from "./types";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>(() => {
    return (localStorage.getItem("ai_provider") as Provider) || "openai";
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
    const saved = localStorage.getItem("gemini_model") || "gemini-2.0-flash";
    const availableModels = GEMINI_MODELS.map((m) => m.value);
    return availableModels.includes(saved as (typeof availableModels)[number])
      ? saved
      : "gemini-3-flash-preview";
  });
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 保存设置到 localStorage
  useEffect(() => {
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("openai_api_key", apiKey);
    localStorage.setItem("openai_base_url", baseUrl);
    localStorage.setItem("openai_model", model);
    localStorage.setItem("gemini_api_key", geminiApiKey);
    localStorage.setItem("gemini_model", geminiModel);
  }, [provider, apiKey, baseUrl, model, geminiApiKey, geminiModel]);

  // 当前 provider 的 key 和 model
  const currentApiKey = provider === "gemini" ? geminiApiKey : apiKey;
  const currentModel = provider === "gemini" ? geminiModel : model;

  // 发送消息 — 通过 server 中转
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (!currentApiKey) {
      setShowSettings(true);
      return;
    }

    const userMessage: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // 创建 assistant 占位消息
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const apiMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...newMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      // 根据 provider 选择不同的 API 端点
      const endpoint = provider === "gemini" ? "/api/gemini" : "/api/chat";
      const body =
        provider === "gemini"
          ? {
              messages: apiMessages,
              model: geminiModel,
              apiKey: geminiApiKey,
              temperature: 0.7,
              maxTokens: 2048,
            }
          : {
              messages: apiMessages,
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
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `API 请求失败 (${response.status})`,
        );
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

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

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: accumulated,
                  };
                }
                return updated;
              });
            }
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: `❌ 错误: ${errorMsg}`,
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 停止生成
  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  // 清空对话
  const clearMessages = () => {
    setMessages([]);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 自动调整输入框高度
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  return {
    // state
    messages,
    input,
    isLoading,
    provider,
    apiKey,
    geminiApiKey,
    baseUrl,
    model,
    geminiModel,
    showSettings,
    currentApiKey,
    currentModel,
    // refs
    messagesEndRef,
    inputRef,
    // actions
    setProvider,
    setApiKey,
    setGeminiApiKey,
    setBaseUrl,
    setModel,
    setGeminiModel,
    setShowSettings,
    setInput,
    sendMessage,
    stopGeneration,
    clearMessages,
    handleKeyDown,
    handleInputChange,
  };
}
