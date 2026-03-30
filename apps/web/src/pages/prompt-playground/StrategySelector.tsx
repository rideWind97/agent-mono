import type { PromptStrategy } from "./types";
import { STRATEGY_PRESETS } from "./types";

interface StrategySelectorProps {
  activeStrategy: PromptStrategy;
  onSelect: (strategy: PromptStrategy) => void;
}

const strategies = Object.values(STRATEGY_PRESETS);

export function StrategySelector({
  activeStrategy,
  onSelect,
}: StrategySelectorProps) {
  return (
    <div className="strategy-selector">
      <h3 className="strategy-selector-title">选择 Prompt 策略</h3>
      <div className="strategy-cards">
        {strategies.map((preset) => (
          <button
            key={preset.id}
            className={`strategy-card ${activeStrategy === preset.id ? "active" : ""}`}
            onClick={() => onSelect(preset.id)}
          >
            <span className="strategy-card-icon">{preset.icon}</span>
            <span className="strategy-card-name">{preset.name}</span>
            <span className="strategy-card-desc">{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
