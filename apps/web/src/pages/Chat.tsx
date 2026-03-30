import { useState, useRef, useEffect, useCallback } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

type Provider = "openai" | "gemini";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT =
  "你是一个友好的 AI 助手，擅长用简洁清晰的中文回答问题。请尽量给出有帮助的回答。";

export function ChatPage() {
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
      localStorage.getItem("openai_base_url") ||
      "https://api.openai.com/v1"
    );
  });
  const [model, setModel] = useState(() => {
    return localStorage.getItem("openai_model") || "gpt-4o-mini";
  });
  const [geminiModel, setGeminiModel] = useState(() => {
    const saved = localStorage.getItem("gemini_model") || "gemini-2.0-flash";
    // 确保保存的模型在可用列表中，否则回退到默认值
    const availableModels = ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.1-flash-image-preview", "gemini-3.1-pro-preview", "gemini-3-pro-image-preview"];
    return availableModels.includes(saved) ? saved : "gemini-3-flash-preview";
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

  // 切换 provider 时自动切换默认值
  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
  };

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error ||
            `API 请求失败 (${response.status})`
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
        // 保留最后一个可能不完整的行
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

          const data = trimmedLine.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);

            // 处理服务端错误
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
            // 如果是我们抛出的错误，继续抛出
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
              throw e;
            }
            // 忽略 JSON 解析错误
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // 用户取消
        return;
      }
      const errorMsg =
        error instanceof Error ? error.message : "未知错误";
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

  return (
    <div className="page chat-page">
      <div className="chat-header">
        <div className="chat-header-left">
          <h1>💬 AI 对话</h1>
          <span className="chat-model-badge">
            {provider === "gemini" ? "✨" : "🤖"} {currentModel}
          </span>
        </div>
        <div className="chat-header-actions">
          <button
            className="btn-icon"
            onClick={clearMessages}
            title="清空对话"
          >
            🗑️
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowSettings(!showSettings)}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="chat-settings">
          {/* Provider 切换 */}
          <div className="settings-field">
            <label>AI 提供商</label>
            <div className="provider-tabs">
              <button
                className={`provider-tab ${provider === "openai" ? "active" : ""}`}
                onClick={() => handleProviderChange("openai")}
              >
                🤖 OpenAI 兼容
              </button>
              <button
                className={`provider-tab ${provider === "gemini" ? "active" : ""}`}
                onClick={() => handleProviderChange("gemini")}
              >
                ✨ Gemini
              </button>
            </div>
          </div>

          {/* OpenAI 设置 */}
          {provider === "openai" && (
            <>
              <div className="settings-field">
                <label>API Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div className="settings-field">
                <label>模型</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>
              <p className="settings-hint">
                💡 支持 OpenAI 兼容 API（如 DeepSeek、通义千问等），修改 Base URL
                即可。设置保存在浏览器本地。
              </p>
            </>
          )}

          {/* Gemini 设置 */}
          {provider === "gemini" && (
            <>
              <div className="settings-field">
                <label>Gemini API Key</label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIza..."
                />
              </div>
              <div className="settings-field">
                <label>模型</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                >
                  <option value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                  <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (Preview)</option>
                  <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image (Preview)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</option>
                  <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image (Preview)</option>
                </select>
              </div>
              <p className="settings-hint">
                💡 使用 Google Gemini API，请在{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                  Google AI Studio
                </a>{" "}
                获取 API Key。设置保存在浏览器本地。
              </p>
            </>
          )}
        </div>
      )}

      {/* 消息列表 */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">🤖</div>
            <h2>开始对话</h2>
            <p>输入你的问题，与 AI 进行对话</p>
            <div className="chat-suggestions">
              {[
                "解释一下什么是 Transformer 架构",
                "用 TypeScript 写一个快速排序",
                "前端开发者如何学习 AI 应用开发？",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-btn"
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message chat-message-${msg.role}`}>
            <div className="message-avatar">
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="message-content">
              <div className="message-role">
                {msg.role === "user" ? "你" : "AI"}
              </div>
              <div className="message-text">
                {msg.content ? (
                  msg.role === "assistant" ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    msg.content
                  )
                ) : (
                  <span className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            disabled={isLoading}
          />
          {isLoading ? (
            <button className="send-btn stop-btn" onClick={stopGeneration}>
              ⏹ 停止
            </button>
          ) : (
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!input.trim()}
            >
              发送 ↑
            </button>
          )}
        </div>
        <p className="chat-input-hint">
          通过 @agent-mono/server 中转 · {provider === "gemini" ? "Gemini API" : "OpenAI 兼容 API"} · 流式输出
        </p>
      </div>
    </div>
  );
}
