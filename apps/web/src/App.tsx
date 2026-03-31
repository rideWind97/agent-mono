import { Routes, Route } from "react-router-dom";

import { Layout } from "@/components/Layout";
import { AboutPage } from "@/pages/About";
import { HomePage } from "@/pages/Home";
import { NotFoundPage } from "@/pages/NotFound";
import { AgentPage } from "@/pages/agent";
import { ChatPage } from "@/pages/chat";
import { PromptPlaygroundPage } from "@/pages/prompt-playground";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/prompt-playground" element={<PromptPlaygroundPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
