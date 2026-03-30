import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/Home";
import { AboutPage } from "@/pages/About";
import { NotFoundPage } from "@/pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
