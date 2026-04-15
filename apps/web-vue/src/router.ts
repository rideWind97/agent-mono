import { createRouter, createWebHistory } from "vue-router";

import SimpleChatView from "./components/SimpleChatView.vue";
import ChatView from "./components/ChatView.vue";
import LearningView from "./components/LearningView.vue";
import AgentLearningView from "./components/AgentLearningView.vue";

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
  {
    path: "/learning",
    name: "learning",
    component: LearningView,
    meta: { title: "Learning" },
  },
  {
    path: "/agent-learning",
    name: "agent-learning",
    component: AgentLearningView,
    meta: { title: "Agent Learning" },
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
