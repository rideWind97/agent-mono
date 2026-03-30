import type { RefObject } from "react";
import type { Provider } from "./types";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  provider: Provider;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
}

export function ChatInput({
  input,
  isLoading,
  provider,
  inputRef,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
}: ChatInputProps) {
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
        通过 @agent-mono/server 中转 ·{" "}
        {provider === "gemini" ? "Gemini API" : "OpenAI 兼容 API"} · 流式输出
      </p>
    </div>
  );
}
