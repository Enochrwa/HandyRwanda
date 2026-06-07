// File: web/src/services/api.ts
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

/**
 * Resolve the backend API base URL.
 *
 * Priority:
 *   1. VITE_API_URL env var  — always used in production builds.
 *      Set this in your .env.production to your Render/Fly backend URL.
 *   2. Same-host port 8000 fallback for local development (Vite on :5173,
 *      backend on :8000, same machine).
 *
 * Never uses window.location.hostname in production — that was the bug.
 */
export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (import.meta.env.PROD) {
    // Production build without VITE_API_URL — fail loudly so devs notice.
    console.error(
      "[HandyRwanda] VITE_API_URL is not set in production build. " +
        "API calls will fail. Set it in .env.production.",
    );
    return "";
  }

  // Local dev: assume backend on same machine, port 8000
  return `${window.location.protocol}//${window.location.hostname}:8000`;
};

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh access token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token } = res.data;
          useAuthStore.getState().updateToken(access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          window.location.href = "/";
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
