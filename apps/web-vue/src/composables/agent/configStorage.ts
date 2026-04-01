import type { AgentConfig } from "./types";
import { AGENT_CONFIG_STORAGE_KEY } from "./types";

export function loadAgentConfig(defaultConfig: AgentConfig): AgentConfig {
  const merged: AgentConfig = { ...defaultConfig };
  const savedConfig = localStorage.getItem(AGENT_CONFIG_STORAGE_KEY);
  if (!savedConfig) return merged;

  try {
    Object.assign(merged, JSON.parse(savedConfig));
  } catch {
    // ignore malformed config
  }
  return merged;
}

export function saveAgentConfig(config: AgentConfig): void {
  localStorage.setItem(AGENT_CONFIG_STORAGE_KEY, JSON.stringify(config));
}
