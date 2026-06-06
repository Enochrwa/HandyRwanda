// File: mobile/src/services/api.ts
import axios from 'axios';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { useAuthStore } from '../store/authStore';

// ── Base URL ────────────────────────────────────────────────────────────────
// .env (EXPO_PUBLIC_API_URL) takes priority.
// For Expo Go on a physical device, fall back to the Metro dev server host,
// automatically detected from expo-constants or expo-router manifest.
// On Android emulator use 10.0.2.2 (host loopback alias).
// Web or native builds without dev host fall back to your LAN IP.

const LAN_IP = 'http://192.168.1.105:8000';

const getDevHost = (): string | null => {
  if (Platform.OS === 'web') return LAN_IP;

  // expo-router / Expo Go: manifest.debuggerHost === "192.168.x.x:8081"
  const debugHost =
    (Constants.expoConfig as any)?.hostUri || (Constants.manifest as any)?.debuggerHost;

  if (debugHost) {
    const host = debugHost.split(':')[0];
    if (host && !host.startsWith('localhost') && !host.startsWith('127.')) {
      return `http://${host}:8000`;
    }
  }

  return null;
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  getDevHost() ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : LAN_IP);

console.log('[API] Base URL:', API_BASE_URL);

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
