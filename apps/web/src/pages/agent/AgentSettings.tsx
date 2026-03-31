import type { AgentProvider } from "./types";
import { GEMINI_AGENT_MODELS } from "./types";

interface AgentSettingsProps {
  provider: AgentProvider;
  apiKey: string;
  geminiApiKey: string;
  baseUrl: string;
  model: string;
  geminiModel: string;
  onProviderChange: (provider: AgentProvider) => void;
  onApiKeyChange: (key: string) => void;
  onGeminiApiKeyChange: (key: string) => void;
  onBaseUrlChange: (url: string) => void;
  onModelChange: (model: string) => void;
  onGeminiModelChange: (model: string) => void;
}

export function AgentSettings({
  provider,
  apiKey,
  geminiApiKey,
  baseUrl,
  model,
  geminiModel,
  onProviderChange,
  onApiKeyChange,
  onGeminiApiKeyChange,
  onBaseUrlChange,
  onModelChange,
  onGeminiModelChange,
}: AgentSettingsProps) {
  return (
    <div className="chat-settings">
      {/* Provider 切换 */}
      <div className="settings-field">
        <label>AI 提供商</label>
        <div className="provider-tabs">
          <button
            className={`provider-tab ${provider === "openai" ? "active" : ""}`}
            onClick={() => onProviderChange("openai")}
          >
            🤖 OpenAI 兼容
          </button>
          <button
            className={`provider-tab ${provider === "gemini" ? "active" : ""}`}
            onClick={() => onProviderChange("gemini")}
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
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="settings-field">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <div className="settings-field">
            <label>模型</label>
            <input
              type="text"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="gpt-4o-mini"
            />
          </div>
          <p className="settings-hint">
            💡 Agent 使用 OpenAI 兼容 API，支持 function calling
            的模型效果最佳。设置保存在浏览器本地。
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
              onChange={(e) => onGeminiApiKeyChange(e.target.value)}
              placeholder="AIza..."
            />
          </div>
          <div className="settings-field">
            <label>模型</label>
            <select
              value={geminiModel}
              onChange={(e) => onGeminiModelChange(e.target.value)}
            >
              {GEMINI_AGENT_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <p className="settings-hint">
            💡 使用 Google Gemini API，支持 function calling 工具调用。请在{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google AI Studio
            </a>{" "}
            获取 API Key。设置保存在浏览器本地。
          </p>
        </>
      )}
    </div>
  );
}
