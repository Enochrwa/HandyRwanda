// File: mobile/src/services/api.ts
import axios from 'axios';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { useAuthStore } from '../store/authStore';

// ── Base URL ────────────────────────────────────────────────────────────────
// Priority:
// 1. .env (EXPO_PUBLIC_API_URL)
// 2. Android emulator fallback
// 3. Hard fallback (your LAN IP)

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:8000' // Android emulator only
    : 'http://192.168.1.105:8000'); // 👈 your Mac IP

// ── Axios instance ─────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // helps detect network issues faster
});

// ── Request interceptor (attach token) ─────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ── Response interceptor (refresh token logic) ─────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Debug (VERY useful for mobile issues)
    console.log('API ERROR:', error?.response?.status, error?.response?.data || error.message);

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        router.replace('/');
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = res.data;

        const user = useAuthStore.getState().user;

        if (user) {
          useAuthStore.getState().setAuth(user, access_token, refreshToken);
        }

        // retry original request with new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        return api(originalRequest);
      } catch (refreshError) {
        console.log('REFRESH FAILED:', refreshError);

        useAuthStore.getState().logout();
        router.replace('/');

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
