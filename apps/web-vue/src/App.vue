<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

import ChatView from "./components/ChatView.vue";
import Sidebar from "./components/Sidebar.vue";

const sidebarCollapsed = ref(false);
const isMobile = ref(false);

function checkMobile() {
  isMobile.value = window.innerWidth < 640;
  if (isMobile.value) {
    sidebarCollapsed.value = true;
  }
}

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});
</script>

<template>
  <div class="app-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'is-mobile': isMobile }">
    <!-- Mobile overlay when sidebar is open -->
    <Transition name="fade">
      <div
        v-if="isMobile && !sidebarCollapsed"
        class="mobile-overlay"
        @click="sidebarCollapsed = true"
      />
    </Transition>

    <Sidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
    <main class="app-main">
      <ChatView />
    </main>
  </div>
</template>

<style lang="scss" scoped>
@use "./styles/variables" as *;
@use "./styles/mixins" as *;

.app-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: $bg-body;
}

.app-main {
  flex: 1;
  min-width: 0;
  @include flex-col;
  height: 100vh;
  transition: margin-left $transition-slow;
}

.mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  z-index: #{$z-sidebar - 1};
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity $transition-base;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
