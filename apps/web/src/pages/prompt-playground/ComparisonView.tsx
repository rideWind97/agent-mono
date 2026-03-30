import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { RunResult } from "./usePromptPlayground";
import { COMPARISON_STRATEGIES } from "./types";

interface ComparisonViewProps {
  userInput: string;
  results: RunResult[];
  isAnyLoading: boolean;
  onUserInputChange: (value: string) => void;
  onRun: () => void;
  onStop: () => void;
  suggestions: string[];
}

export function ComparisonView({
  userInput,
  results,
  isAnyLoading,
  onUserInputChange,
  onRun,
  onStop,
  suggestions,
}: ComparisonViewProps) {
  return (
    <div className="comparison-view">
      {/* 输入区域 */}
      <div className="prompt-section">
        <div className="prompt-section-header">
          <h4>💬 对比输入（同一问题，三种策略）</h4>
        </div>
        <textarea
          className="prompt-textarea user-input-textarea"
          value={userInput}
          onChange={(e) => onUserInputChange(e.target.value)}
          placeholder="输入一个问题，系统会分别用 Zero-shot、Few-shot、CoT 三种策略发送..."
          rows={3}
        />
        <div className="prompt-suggestions">
          {suggestions.map((suggestion, idx) => (
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
        {isAnyLoading ? (
          <button className="btn-run btn-stop" onClick={onStop}>
            ⏹ 停止全部
          </button>
        ) : (
          <button
            className="btn-run"
            onClick={onRun}
            disabled={!userInput.trim()}
          >
            ▶ 运行对比实验
          </button>
        )}
      </div>

      {/* 三列对比结果 */}
      {results.length > 0 && (
        <div className="comparison-grid">
          {results.map((result, idx) => {
            const strategy = COMPARISON_STRATEGIES[idx] as
              | (typeof COMPARISON_STRATEGIES)[number]
              | undefined;
            return (
              <div key={idx} className="comparison-column">
                <div className="comparison-column-header">
                  <span className="comparison-strategy-icon">
                    {strategy?.icon ?? "📊"}
                  </span>
                  <span className="comparison-strategy-name">
                    {result.strategyName}
                  </span>
                  {result.isLoading && (
                    <span className="loading-badge">生成中...</span>
                  )}
                  {result.duration !== null && (
                    <span className="duration-badge">
                      {(result.duration / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                <div className="comparison-output">
                  {result.error ? (
                    <div className="comparison-error">❌ {result.error}</div>
                  ) : result.output ? (
                    <MarkdownRenderer content={result.output} />
                  ) : result.isLoading ? (
                    <span className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
