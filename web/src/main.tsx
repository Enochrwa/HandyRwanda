// File: web/src/main.tsx
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getRouter } from "./router";
import "./styles.css";
import "@/i18n";

// Single shared QueryClient used by both RouterProvider context and QueryClientProvider.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes — reduces redundant refetches
      retry: 2,
    },
  },
});

const router = getRouter(queryClient);

const rootElement = document.getElementById("root")!;
ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
