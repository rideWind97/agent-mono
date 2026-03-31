<script setup lang="ts">
import { computed } from "vue";

import type { ToolCallEvent } from "../composables/useAgent";

const props = defineProps<{
  events: ToolCallEvent[];
}>();

interface ToolPair {
  tool: string;
  input?: unknown;
  output?: string;
  status: "running" | "done";
}

const toolPairs = computed<ToolPair[]>(() => {
  const pairs: ToolPair[] = [];
  const starts = new Map<string, ToolCallEvent>();

  for (const event of props.events) {
    if (event.type === "tool_start") {
      starts.set(event.tool, event);
      pairs.push({
        tool: event.tool,
        input: event.input,
        status: "running",
      });
    }
    if (event.type === "tool_end") {
      const existing = pairs.find((p) => p.tool === event.tool && p.status === "running");
      if (existing) {
        existing.output = event.output;
        existing.status = "done";
      } else {
        pairs.push({
          tool: event.tool,
          output: event.output,
          status: "done",
        });
      }
    }
  }

  return pairs;
});

const TOOL_ICONS: Record<string, string> = {
  get_weather: "🌤️",
  calculator: "🧮",
  get_current_time: "🕐",
  translate: "🌐",
};

function formatOutput(output?: string): string {
  if (!output) return "";
  try {
    const parsed = JSON.parse(output);
    return parsed.message || JSON.stringify(parsed, null, 2);
  } catch {
    return output;
  }
}
</script>

<template>
  <div v-if="toolPairs.length" class="tool-calls">
    <div v-for="(pair, idx) in toolPairs" :key="idx" class="tool-card">
      <div class="tool-header">
        <span class="tool-icon">{{ TOOL_ICONS[pair.tool] || "🔧" }}</span>
        <span class="tool-name">{{ pair.tool }}</span>
        <span v-if="pair.status === 'running'" class="tool-status running">
          <span class="spinner" /> 执行中...
        </span>
        <span v-else class="tool-status done">✓ 完成</span>
      </div>

      <div v-if="pair.input" class="tool-section">
        <span class="tool-label">输入</span>
        <code class="tool-code">{{ typeof pair.input === "string" ? pair.input : JSON.stringify(pair.input) }}</code>
      </div>

      <div v-if="pair.output" class="tool-section">
        <span class="tool-label">结果</span>
        <span class="tool-result">{{ formatOutput(pair.output) }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.tool-calls {
  @include flex-col;
  gap: $space-2;
  margin-bottom: $space-2;
}

.tool-card {
  background: $primary-bg;
  border: 1px solid rgba($primary, 0.15);
  border-radius: $radius-sm;
  padding: $space-3 $space-4;
  font-size: $font-sm;
  animation: fadeIn 0.25s ease;

  @include mobile {
    padding: $space-2 $space-3;
    font-size: $font-xs;
  }
}

.tool-header {
  display: flex;
  align-items: center;
  gap: $space-2;
  margin-bottom: $space-2;
}

.tool-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.tool-name {
  font-weight: $font-weight-semibold;
  color: $primary;
  font-family: $font-mono;
  font-size: $font-xs;
}

.tool-status {
  margin-left: auto;
  font-size: $font-xs;
  display: flex;
  align-items: center;
  gap: $space-1;

  &.running {
    color: $warning;
  }

  &.done {
    color: $success;
  }
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid $warning;
  border-top-color: transparent;
  border-radius: $radius-full;
  animation: spin 0.8s linear infinite;
}

.tool-section {
  display: flex;
  align-items: baseline;
  gap: $space-2;
  margin-top: $space-1;
  line-height: $line-height-normal;
}

.tool-label {
  color: $text-secondary;
  font-weight: $font-weight-medium;
  white-space: nowrap;
  font-size: $font-xs;
}

.tool-code {
  background: rgba($primary, 0.08);
  padding: 1px $space-2;
  border-radius: $radius-xs;
  font-size: $font-xs;
  font-family: $font-mono;
  word-break: break-all;
  color: $text-primary;
}

.tool-result {
  color: $text-primary;
  word-break: break-word;
}
</style>
