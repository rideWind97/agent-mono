import type { RefObject } from "react";

import type { AgentProvider } from "./types";

interface AgentInputProps {
  input: string;
  isLoading: boolean;
  provider: AgentProvider;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
}

export function AgentInput({
  input,
  isLoading,
  provider,
  inputRef,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
}: AgentInputProps) {
  return (
    <div className="chat-input-area">
      <div className="chat-input-wrapper">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={1}
          disabled={isLoading}
        />
        {isLoading ? (
          <button className="send-btn stop-btn" onClick={onStop}>
            ⏹ 停止
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={onSend}
            disabled={!input.trim()}
          >
            发送 ↑
          </button>
        )}
      </div>
      <p className="chat-input-hint">
        {provider === "gemini" ? "Gemini Function Calling" : "LangChain ReAct Agent"}{" "}
        · 支持工具调用 · 流式输出
      </p>
    </div>
  );
}
