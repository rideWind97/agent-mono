<script setup lang="ts">
import type { AgentConfig } from "../composables/useAgent";

const props = defineProps<{
  config: AgentConfig;
}>();

const emit = defineEmits<{
  (e: "update:config", config: AgentConfig): void;
  (e: "save"): void;
  (e: "close"): void;
}>();

const modelOptions = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini", group: "OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", group: "OpenAI" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", group: "OpenAI" },
  { value: "deepseek-chat", label: "DeepSeek Chat", group: "DeepSeek" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner", group: "DeepSeek" },
];

function updateField(field: keyof AgentConfig, value: string | number) {
  emit("update:config", { ...props.config, [field]: value });
}

function handleSave() {
  emit("save");
  emit("close");
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("settings-overlay")) {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div class="settings-overlay" @click="handleOverlayClick">
        <Transition name="panel" appear>
          <div class="settings-panel">
            <!-- Header -->
            <div class="panel-header">
              <div class="panel-title">
                <span class="panel-icon">⚙️</span>
                <h3>设置</h3>
              </div>
              <button class="close-btn" @click="emit('close')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="panel-body">
              <!-- API Key -->
              <div class="field">
                <label class="field-label">
                  API Key
                  <span class="field-hint">用于调用 LLM 服务</span>
                </label>
                <input
                  type="password"
                  class="field-input"
                  :value="config.apiKey"
                  placeholder="sk-..."
                  autocomplete="off"
                  @input="updateField('apiKey', ($event.target as HTMLInputElement).value)"
                />
              </div>

              <!-- Base URL -->
              <div class="field">
                <label class="field-label">
                  Base URL
                  <span class="field-hint">API 服务地址</span>
                </label>
                <input
                  type="text"
                  class="field-input"
                  :value="config.baseUrl"
                  placeholder="https://api.openai.com"
                  @input="updateField('baseUrl', ($event.target as HTMLInputElement).value)"
                />
              </div>

              <!-- Model -->
              <div class="field">
                <label class="field-label">模型</label>
                <select
                  class="field-input"
                  :value="config.model"
                  @change="updateField('model', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <!-- Temperature & Max Tokens -->
              <div class="field-row">
                <div class="field">
                  <label class="field-label">
                    Temperature
                    <span class="field-value">{{ config.temperature }}</span>
                  </label>
                  <div class="range-wrapper">
                    <input
                      type="range"
                      class="field-range"
                      :value="config.temperature"
                      min="0"
                      max="2"
                      step="0.1"
                      @input="updateField('temperature', Number(($event.target as HTMLInputElement).value))"
                    />
                    <div class="range-labels">
                      <span>精确</span>
                      <span>创意</span>
                    </div>
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Max Tokens</label>
                  <input
                    type="number"
                    class="field-input"
                    :value="config.maxTokens"
                    min="100"
                    max="8192"
                    step="100"
                    @input="updateField('maxTokens', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="panel-footer">
              <button class="btn btn-secondary" @click="emit('close')">取消</button>
              <button class="btn btn-primary" @click="handleSave">保存设置</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

// ============================================
// Overlay
// ============================================
.settings-overlay {
  @include overlay;
  @include flex-center;
}

// ============================================
// Panel
// ============================================
.settings-panel {
  @include panel;
  width: 520px;
  border-radius: $radius-lg;

  @include mobile {
    width: 100%;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }

  @include tablet {
    width: 480px;
  }
}

// ============================================
// Header
// ============================================
.panel-header {
  @include flex-between;
  padding: $space-5 $space-6;
  border-bottom: 1px solid $border-color;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: $space-2;

  h3 {
    font-size: $font-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }
}

.panel-icon {
  font-size: 20px;
}

.close-btn {
  @include icon-btn(32px);
}

// ============================================
// Body
// ============================================
.panel-body {
  @include flex-col;
  gap: $space-5;
  padding: $space-6;

  @include mobile {
    padding: $space-4;
    gap: $space-4;
  }
}

.field {
  @include flex-col;
  gap: $space-2;
  flex: 1;
}

.field-label {
  display: flex;
  align-items: baseline;
  gap: $space-2;
  font-size: $font-sm;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.field-hint {
  font-size: $font-xs;
  color: $text-muted;
  font-weight: $font-weight-normal;
}

.field-value {
  font-size: $font-xs;
  color: $primary;
  font-weight: $font-weight-semibold;
  font-family: $font-mono;
  margin-left: auto;
}

.field-input {
  @include input-base;
}

.field-row {
  display: flex;
  gap: $space-4;

  @include mobile {
    flex-direction: column;
    gap: $space-4;
  }
}

// Range slider
.range-wrapper {
  @include flex-col;
  gap: $space-1;
}

.field-range {
  width: 100%;
  height: 6px;
  appearance: none;
  background: $gray-200;
  border-radius: $radius-full;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    background: $primary;
    border-radius: $radius-full;
    border: 2px solid $bg-card;
    box-shadow: $shadow-sm;
    cursor: pointer;
    transition: transform $transition-fast;

    &:hover {
      transform: scale(1.15);
    }
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: $primary;
    border-radius: $radius-full;
    border: 2px solid $bg-card;
    box-shadow: $shadow-sm;
    cursor: pointer;
  }
}

.range-labels {
  @include flex-between;
  font-size: $font-xs;
  color: $text-muted;
}

// ============================================
// Footer
// ============================================
.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: $space-2;
  padding: $space-4 $space-6;
  border-top: 1px solid $border-color;

  @include mobile {
    padding: $space-4;
  }
}

.btn {
  @include btn-base;
  padding: $space-2 $space-5;
  font-size: $font-sm;
  border-radius: $radius-sm;
}

.btn-primary {
  background: $primary;
  color: $text-inverse;

  &:hover:not(:disabled) {
    background: $primary-hover;
    box-shadow: $shadow-sm;
  }
}

.btn-secondary {
  background: $bg-input;
  color: $text-secondary;

  &:hover:not(:disabled) {
    background: $gray-200;
    color: $text-primary;
  }
}

// ============================================
// Transitions
// ============================================
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity $transition-base;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.panel-enter-active {
  transition: all $transition-slow;
}

.panel-leave-active {
  transition: all $transition-base;
}

.panel-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.panel-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
