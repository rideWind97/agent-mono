<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="brand">
        Agent Mono
      </div>
      <nav class="nav">
        <RouterLink to="/">
          首页
        </RouterLink>
        <RouterLink to="/chat">
          对话
        </RouterLink>
        <RouterLink to="/learning">
          学习
        </RouterLink>
      </nav>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
