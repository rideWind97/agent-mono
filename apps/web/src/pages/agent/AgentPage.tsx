import { useAgent } from "./useAgent";
import { AgentSettings } from "./AgentSettings";
import { AgentMessageList } from "./AgentMessageList";
import { AgentInput } from "./AgentInput";
import { AgentToolPanel } from "./AgentToolPanel";

export function AgentPage() {
  const agent = useAgent();

  return (
    <div className="page agent-page">
      <div className="chat-header">
        <div className="chat-header-left">
          <h1>🤖 AI 代理</h1>
          <span className="chat-model-badge">
            {agent.provider === "gemini" ? "✨" : "🧠"} {agent.currentModel}
          </span>
        </div>
        <div className="chat-header-actions">
          <button
            className="btn-icon"
            onClick={agent.clearMessages}
            title="清空对话"
          >
            🗑️
          </button>
          <button
            className="btn-icon"
            onClick={() => agent.setShowSettings(!agent.showSettings)}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </div>

      {agent.showSettings && (
        <AgentSettings
          provider={agent.provider}
          apiKey={agent.apiKey}
          geminiApiKey={agent.geminiApiKey}
          baseUrl={agent.baseUrl}
          model={agent.model}
          geminiModel={agent.geminiModel}
          onProviderChange={agent.setProvider}
          onApiKeyChange={agent.setApiKey}
          onGeminiApiKeyChange={agent.setGeminiApiKey}
          onBaseUrlChange={agent.setBaseUrl}
          onModelChange={agent.setModel}
          onGeminiModelChange={agent.setGeminiModel}
        />
      )}

      <div className="agent-content">
        <div className="agent-main">
          <AgentMessageList
            messages={agent.messages}
            messagesEndRef={agent.messagesEndRef}
            inputRef={agent.inputRef}
            onSuggestionClick={agent.setInput}
          />
        </div>

        <AgentToolPanel toolCalls={agent.toolCalls} />
      </div>

      <AgentInput
        input={agent.input}
        isLoading={agent.isLoading}
        provider={agent.provider}
        inputRef={agent.inputRef}
        onInputChange={agent.handleInputChange}
        onKeyDown={agent.handleKeyDown}
        onSend={agent.sendMessage}
        onStop={agent.stopGeneration}
      />
    </div>
  );
}
