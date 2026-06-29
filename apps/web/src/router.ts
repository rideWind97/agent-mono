import { createRouter, createWebHistory } from "vue-router";

import ChatView from "@/views/ChatView.vue";
import HomeView from "@/views/HomeView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/chat", name: "chat", component: ChatView },
  ],
});
