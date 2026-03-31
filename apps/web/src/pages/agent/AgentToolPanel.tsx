import type { ToolCall } from "./types";

interface AgentToolPanelProps {
  toolCalls: ToolCall[];
}

/** 工具名称映射 */
const TOOL_LABELS: Record<string, string> = {
  get_weather: "🌤️ 天气查询",
  calculator: "🧮 计算器",
  get_current_time: "🕐 当前时间",
};

function formatToolInput(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function formatToolOutput(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

export function AgentToolPanel({ toolCalls }: AgentToolPanelProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="agent-tool-panel">
      <div className="agent-tool-panel-title">🔧 工具调用</div>
      <div className="agent-tool-list">
        {toolCalls.map((tc, idx) => (
          <div
            key={idx}
            className={`agent-tool-item ${tc.status === "running" ? "running" : "done"}`}
          >
            <div className="agent-tool-header">
              <span className="agent-tool-name">
                {TOOL_LABELS[tc.tool] || `🔧 ${tc.tool}`}
              </span>
              <span
                className={`agent-tool-status ${tc.status === "running" ? "status-running" : "status-done"}`}
              >
                {tc.status === "running" ? "⏳ 执行中..." : "✅ 完成"}
              </span>
            </div>
            {tc.input != null && (
              <div className="agent-tool-detail">
                <span className="agent-tool-label">输入:</span>
                <code>{String(formatToolInput(tc.input))}</code>
              </div>
            )}
            {tc.output != null && (
              <div className="agent-tool-detail">
                <span className="agent-tool-label">输出:</span>
                <code>{String(formatToolOutput(tc.output))}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
