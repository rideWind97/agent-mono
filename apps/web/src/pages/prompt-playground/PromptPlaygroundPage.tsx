import { ChatSettings } from "@/pages/chat/ChatSettings";
import { usePromptPlayground } from "./usePromptPlayground";
import { StrategySelector } from "./StrategySelector";
import { PromptPanel } from "./PromptPanel";
import { ComparisonView } from "./ComparisonView";
import { STRATEGY_PRESETS } from "./types";

export function PromptPlaygroundPage() {
  const pg = usePromptPlayground();
  const isComparison = pg.activeStrategy === "comparison";

  return (
    <div className="page prompt-playground-page">
      <div className="playground-header">
        <div className="playground-header-left">
          <h1>🧪 Prompt 实验室</h1>
          <span className="playground-model-badge">
            {pg.provider === "gemini" ? "✨" : "🤖"} {pg.currentModel}
          </span>
        </div>
        <div className="playground-header-actions">
          <button
            className="btn-icon"
            onClick={() => pg.setShowSettings(!pg.showSettings)}
            title="API 设置"
          >
            ⚙️
          </button>
        </div>
      </div>

      {pg.showSettings && (
        <ChatSettings
          provider={pg.provider}
          apiKey={pg.apiKey}
          geminiApiKey={pg.geminiApiKey}
          baseUrl={pg.baseUrl}
          model={pg.model}
          geminiModel={pg.geminiModel}
          onProviderChange={pg.setProvider}
          onApiKeyChange={pg.setApiKey}
          onGeminiApiKeyChange={pg.setGeminiApiKey}
          onBaseUrlChange={pg.setBaseUrl}
          onModelChange={pg.setModel}
          onGeminiModelChange={pg.setGeminiModel}
        />
      )}

      <StrategySelector
        activeStrategy={pg.activeStrategy}
        onSelect={pg.switchStrategy}
      />

      {isComparison ? (
        <ComparisonView
          userInput={pg.userInput}
          results={pg.comparisonResults}
          isAnyLoading={pg.comparisonResults.some((r) => r.isLoading)}
          onUserInputChange={pg.setUserInput}
          onRun={pg.runComparison}
          onStop={pg.stopAll}
          suggestions={STRATEGY_PRESETS.comparison.suggestions}
        />
      ) : (
        <PromptPanel
          activeStrategy={pg.activeStrategy}
          systemPrompt={pg.systemPrompt}
          userInput={pg.userInput}
          output={pg.output}
          isLoading={pg.isLoading}
          onSystemPromptChange={pg.setSystemPrompt}
          onUserInputChange={pg.setUserInput}
          onRun={pg.runStrategy}
          onStop={pg.stopAll}
        />
      )}
    </div>
  );
}
