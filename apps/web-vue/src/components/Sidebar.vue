<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
}>();

const route = useRoute();
const router = useRouter();

const navItems = [
  { icon: "💬", label: "AI 对话", to: "/" },
  { icon: "🤖", label: "Agent", to: "/agent" },
];

function navigate(path: string) {
  router.push(path);
}

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <!-- Logo -->
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">🤖</span>
        <Transition name="fade">
          <span v-if="!collapsed" class="logo-text">LangChain Demo</span>
        </Transition>
      </div>
      <button class="toggle-btn" :title="collapsed ? '展开侧边栏' : '收起侧边栏'" @click="emit('toggle')">
        <span class="toggle-icon" :class="{ flipped: collapsed }">‹</span>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
        :title="collapsed ? item.label : ''"
        @click="navigate(item.to)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <Transition name="fade">
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </Transition>
      </button>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="tech-badge">
        <span class="badge-dot" />
        <Transition name="fade">
          <span v-if="!collapsed" class="badge-text">Vue3 + Fastify + LangChain</span>
        </Transition>
      </div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.sidebar {
  width: $sidebar-width;
  height: 100vh;
  background: $bg-sidebar;
  border-right: 1px solid $border-color;
  @include flex-col;
  transition: width $transition-slow;
  flex-shrink: 0;
  overflow: hidden;
  z-index: $z-sidebar;

  &.collapsed {
    width: 68px;
  }

  @include mobile {
    position: fixed;
    left: 0;
    top: 0;
    box-shadow: $shadow-lg;

    &.collapsed {
      width: 0;
      border-right: none;
    }
  }
}

// Header
.sidebar-header {
  @include flex-between;
  padding: $space-4 $space-4 $space-3;
  min-height: $header-height;
}

.logo {
  display: flex;
  align-items: center;
  gap: $space-3;
  overflow: hidden;
}

.logo-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.logo-text {
  font-size: $font-lg;
  font-weight: $font-weight-bold;
  color: $text-primary;
  white-space: nowrap;
}

.toggle-btn {
  @include icon-btn(28px);
  flex-shrink: 0;
}

.toggle-icon {
  font-size: 18px;
  font-weight: bold;
  transition: transform $transition-base;
  display: inline-block;

  &.flipped {
    transform: rotate(180deg);
  }
}

// New Chat Button
.sidebar-action {
  padding: 0 $space-3 $space-3;
}

.new-chat-btn {
  @include btn-base;
  width: 100%;
  gap: $space-2;
  padding: $space-3;
  background: $primary;
  color: $text-inverse;
  font-size: $font-base;
  overflow: hidden;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: $primary-hover;
    box-shadow: $shadow-md;
  }

  .btn-icon {
    font-size: 18px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }
}

// Navigation
.sidebar-nav {
  flex: 1;
  padding: $space-2 $space-3;
  @include flex-col;
  gap: $space-1;
}

.nav-item {
  @include btn-reset;
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-3;
  border-radius: $radius-sm;
  font-size: $font-base;
  color: $text-secondary;
  transition: all $transition-fast;
  overflow: hidden;
  white-space: nowrap;
  text-align: left;

  &:hover {
    background: $gray-100;
    color: $text-primary;
  }

  &.active {
    background: $primary-light;
    color: $primary;
    font-weight: $font-weight-medium;
  }

  .nav-icon {
    font-size: 18px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }
}

// Footer
.sidebar-footer {
  padding: $space-4;
  border-top: 1px solid $border-light;
}

.tech-badge {
  display: flex;
  align-items: center;
  gap: $space-2;
  overflow: hidden;
}

.badge-dot {
  width: 8px;
  height: 8px;
  background: $success;
  border-radius: $radius-full;
  flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}

.badge-text {
  font-size: $font-xs;
  color: $text-muted;
  white-space: nowrap;
}

// Transition
.fade-enter-active,
.fade-leave-active {
  transition: opacity $transition-fast;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
