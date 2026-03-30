import { useChat } from "./useChat";
import { ChatSettings } from "./ChatSettings";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

export function ChatPage() {
  const chat = useChat();

  return (
    <div className="page chat-page">
      <div className="chat-header">
        <div className="chat-header-left">
          <h1>💬 AI 对话</h1>
          <span className="chat-model-badge">
            {chat.provider === "gemini" ? "✨" : "🤖"} {chat.currentModel}
          </span>
        </div>
        <div className="chat-header-actions">
          <button
            className="btn-icon"
            onClick={chat.clearMessages}
            title="清空对话"
          >
            🗑️
          </button>
          <button
            className="btn-icon"
            onClick={() => chat.setShowSettings(!chat.showSettings)}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </div>

      {chat.showSettings && (
        <ChatSettings
          provider={chat.provider}
          apiKey={chat.apiKey}
          geminiApiKey={chat.geminiApiKey}
          baseUrl={chat.baseUrl}
          model={chat.model}
          geminiModel={chat.geminiModel}
          onProviderChange={chat.setProvider}
          onApiKeyChange={chat.setApiKey}
          onGeminiApiKeyChange={chat.setGeminiApiKey}
          onBaseUrlChange={chat.setBaseUrl}
          onModelChange={chat.setModel}
          onGeminiModelChange={chat.setGeminiModel}
        />
      )}

      <ChatMessageList
        messages={chat.messages}
        messagesEndRef={chat.messagesEndRef}
        inputRef={chat.inputRef}
        onSuggestionClick={chat.setInput}
      />

      <ChatInput
        input={chat.input}
        isLoading={chat.isLoading}
        provider={chat.provider}
        inputRef={chat.inputRef}
        onInputChange={chat.handleInputChange}
        onKeyDown={chat.handleKeyDown}
        onSend={chat.sendMessage}
        onStop={chat.stopGeneration}
      />
    </div>
  );
}
