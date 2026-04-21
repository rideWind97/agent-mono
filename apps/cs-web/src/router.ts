import { createRouter, createWebHistory } from "vue-router";
import CustomerChat from "./components/CustomerChat.vue";
import AgentWorkbench from "./components/AgentWorkbench.vue";

const routes = [
  {
    path: "/",
    name: "chat",
    component: CustomerChat,
    meta: { title: "智能客服" },
  },
  {
    path: "/agent",
    name: "agent-workbench",
    component: AgentWorkbench,
    meta: { title: "坐席工作台" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  document.title = `${to.meta.title || "智能客服"} - CS System`;
});

export default router;
