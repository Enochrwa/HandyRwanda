// File: web/vite.config.ts
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL || "http://localhost:8000";

  return {
    plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    // Dev proxy: forward /api/* to backend — avoids CORS in local dev
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: {
      // Source maps in production help debug Sentry/Render errors
      sourcemap: mode === "production" ? "hidden" : true,
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
  };
});
