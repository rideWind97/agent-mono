<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <div class="app-shell">
    <nav class="top-nav">
      <div class="nav-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        </svg>
        <span>智能客服系统</span>
      </div>
      <div class="nav-links">
        <router-link to="/" :class="{ active: route.name === 'chat' }">
          客户端
        </router-link>
        <router-link to="/agent" :class="{ active: route.name === 'agent-workbench' }">
          坐席工作台
        </router-link>
      </div>
    </nav>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style lang="scss" scoped>
@use "./styles/variables" as *;
@use "./styles/mixins" as *;

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: $bg-body;
}

.top-nav {
  @include flex-between;
  padding: 0 $space-6;
  height: 52px;
  background: $bg-card;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-weight: $font-weight-semibold;
  font-size: $font-md;
  color: $primary;

  svg { width: 22px; height: 22px; }
}

.nav-links {
  display: flex;
  gap: $space-1;

  a {
    padding: $space-2 $space-4;
    border-radius: $radius-sm;
    font-size: $font-sm;
    font-weight: $font-weight-medium;
    color: $text-secondary;
    text-decoration: none;
    transition: all $transition-fast;

    &:hover {
      background: $gray-100;
      color: $text-primary;
    }

    &.active {
      background: $primary-light;
      color: $primary;
    }
  }
}

.app-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
