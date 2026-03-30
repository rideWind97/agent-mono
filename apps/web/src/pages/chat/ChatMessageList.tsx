import type { RefObject } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { Message } from "./types";
import { CHAT_SUGGESTIONS } from "./types";

interface ChatMessageListProps {
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSuggestionClick: (suggestion: string) => void;
}

export function ChatMessageList({
  messages,
  messagesEndRef,
  inputRef,
  onSuggestionClick,
}: ChatMessageListProps) {
  return (
    <div className="chat-messages">
      {messages.length === 0 && (
        <div className="chat-empty">
          <div className="chat-empty-icon">🤖</div>
          <h2>开始对话</h2>
          <p>输入你的问题，与 AI 进行对话</p>
          <div className="chat-suggestions">
            {CHAT_SUGGESTIONS.map((suggestion) => (
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
  );
}
