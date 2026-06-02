// File: web/vite.config.ts
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react/jsx-runtime"],
          router: ["@tanstack/react-router"],
          query: ["@tanstack/react-query"],
          charts: ["recharts"],
          ui: ["lucide-react", "sonner", "date-fns"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
