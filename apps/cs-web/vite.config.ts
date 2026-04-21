import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5300,
    proxy: {
      "/api/cs": {
        target: "http://localhost:3400",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://localhost:3400",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
