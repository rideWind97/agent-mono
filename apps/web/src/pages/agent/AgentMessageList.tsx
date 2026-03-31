import type { RefObject } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { Message } from "./types";
import { AGENT_SUGGESTIONS } from "./types";

interface AgentMessageListProps {
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSuggestionClick: (suggestion: string) => void;
}

export function AgentMessageList({
  messages,
  messagesEndRef,
  inputRef,
  onSuggestionClick,
}: AgentMessageListProps) {
  return (
    <div className="chat-messages">
      {messages.length === 0 && (
        <div className="chat-empty">
          <div className="chat-empty-icon">🤖</div>
          <h2>AI 代理</h2>
          <p>拥有工具能力的智能代理，可以查询天气、计算数学、获取时间</p>
          <div className="agent-tools-info">
            <span className="agent-tool-badge">🌤️ 天气查询</span>
            <span className="agent-tool-badge">🧮 计算器</span>
            <span className="agent-tool-badge">🕐 当前时间</span>
          </div>
          <div className="chat-suggestions">
            {AGENT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                className="suggestion-btn"
                onClick={() => {
                  onSuggestionClick(suggestion);
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
              {msg.role === "user" ? "你" : "Agent"}
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
  );
}
