import { createRouter, createWebHistory } from "vue-router";

import SimpleChatView from "./components/SimpleChatView.vue";
import ChatView from "./components/ChatView.vue";

const routes = [
  {
    path: "/",
    name: "chat",
    component: SimpleChatView,
    meta: { title: "AI Chat" },
  },
  {
    path: "/agent",
    name: "agent",
    component: ChatView,
    meta: { title: "Agent" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  document.title = `${to.meta.title || "AI Chat"} - LangChain Demo`;
});

export default router;
