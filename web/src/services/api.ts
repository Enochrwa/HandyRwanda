// File: web/src/services/api.ts
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

export const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return import.meta.env.VITE_API_URL;
};

const api = axios.create({
  baseURL: getApiBaseUrl() || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
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
