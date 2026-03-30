import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { PromptStrategy } from "./types";
import { STRATEGY_PRESETS } from "./types";

interface PromptPanelProps {
  activeStrategy: PromptStrategy;
  systemPrompt: string;
  userInput: string;
  output: string;
  isLoading: boolean;
  onSystemPromptChange: (value: string) => void;
  onUserInputChange: (value: string) => void;
  onRun: () => void;
  onStop: () => void;
}

export function PromptPanel({
  activeStrategy,
  systemPrompt,
  userInput,
  output,
  isLoading,
  onSystemPromptChange,
  onUserInputChange,
  onRun,
  onStop,
}: PromptPanelProps) {
  const preset = STRATEGY_PRESETS[activeStrategy];
  const hasFewShot =
    preset.fewShotMessages && preset.fewShotMessages.length > 0;

  return (
    <div className="prompt-panel">
      {/* 策略说明 */}
      <div className="prompt-explanation">
        <MarkdownRenderer content={preset.explanation} />
      </div>

      {/* System Prompt 编辑器 */}
      <div className="prompt-section">
        <div className="prompt-section-header">
          <h4>📝 System Prompt</h4>
          <button
            className="btn-text"
            onClick={() => onSystemPromptChange(preset.systemPrompt)}
          >
            重置
          </button>
        </div>
        <textarea
          className="prompt-textarea system-prompt-textarea"
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          rows={8}
        />
      </div>

      {/* Few-shot 示例展示 */}
      {hasFewShot && (
        <div className="prompt-section">
          <div className="prompt-section-header">
            <h4>📚 Few-shot 示例 ({preset.fewShotMessages!.length / 2} 组)</h4>
          </div>
          <div className="few-shot-examples">
            {preset.fewShotMessages!.map((msg, idx) => (
              <div key={idx} className={`few-shot-msg few-shot-${msg.role}`}>
                <span className="few-shot-role">
                  {msg.role === "user" ? "👤 User" : "🤖 Assistant"}
                </span>
                <pre className="few-shot-content">{msg.content}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 用户输入 */}
      <div className="prompt-section">
        <div className="prompt-section-header">
          <h4>💬 用户输入</h4>
        </div>
        <textarea
          className="prompt-textarea user-input-textarea"
          value={userInput}
          onChange={(e) => onUserInputChange(e.target.value)}
          placeholder="输入你的问题，或点击下方建议..."
          rows={4}
        />
        <div className="prompt-suggestions">
          {preset.suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              className="prompt-suggestion-btn"
              onClick={() => onUserInputChange(suggestion)}
              title={suggestion}
            >
              {suggestion.length > 50
                ? `${suggestion.slice(0, 50)}...`
                : suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* 运行按钮 */}
      <div className="prompt-actions">
        {isLoading ? (
          <button className="btn-run btn-stop" onClick={onStop}>
            ⏹ 停止生成
          </button>
        ) : (
          <button
            className="btn-run"
            onClick={onRun}
            disabled={!userInput.trim()}
          >
            ▶ 运行
          </button>
        )}
      </div>

      {/* 输出区域 */}
      {(output || isLoading) && (
        <div className="prompt-section">
          <div className="prompt-section-header">
            <h4>🤖 模型输出</h4>
            {isLoading && <span className="loading-badge">生成中...</span>}
          </div>
          <div className="prompt-output">
            {output ? (
              <MarkdownRenderer content={output} />
            ) : (
              <span className="typing-indicator">
                <span />
                <span />
                <span />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
