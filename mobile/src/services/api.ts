// File: mobile/src/services/api.ts
import axios from 'axios';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { useAuthStore } from '../store/authStore';

// ── Base URL ────────────────────────────────────────────────────────────────
// Priority:
//   1. EXPO_PUBLIC_API_URL env var (set in .env or EAS secrets)
//   2. Auto-detected from Expo Go dev host (works on physical device + same LAN)
//   3. Android emulator loopback (10.0.2.2)
//   4. iOS simulator / web fallback

const FALLBACK_LAN_IP = 'http://192.168.1.105:8000'; // update if your LAN IP changes

const getDevHost = (): string | null => {
  if (Platform.OS === 'web') return null;

  // expo-router v6 / Expo SDK 54: hostUri lives on expoConfig in Expo Go
  // Format is "192.168.x.x:8081" — we strip the Metro port and use 8000
  const rawHostUri: string | undefined =
    (Constants.expoConfig as any)?.hostUri ??
    (Constants.manifest2 as any)?.extra?.expoClient?.hostUri ??
    (Constants.manifest as any)?.debuggerHost;

  if (rawHostUri) {
    // Could be "192.168.1.50:8081" or just "192.168.1.50"
    const host = rawHostUri.split(':')[0].trim();
    if (host && !host.startsWith('localhost') && !host.startsWith('127.')) {
      return `http://${host}:8000`;
    }
  }

  return null;
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  getDevHost() ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : FALLBACK_LAN_IP);

console.log('[API] Base URL:', API_BASE_URL);

// ── Axios instance ─────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000, // 15 s — more forgiving on slow mobile connections
});

// ── Request interceptor (attach token) ─────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor (token refresh + debug logging) ───────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Always log the raw error — very useful during Expo Go testing
    console.warn(
      '[API ERROR]',
      error?.response?.status,
      error?.config?.url,
      JSON.stringify(error?.response?.data ?? error.message),
    );

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        router.replace('/auth');
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = res.data;
        const { user } = useAuthStore.getState();

        if (user) {
          useAuthStore.getState().setAuth(user, access_token, refreshToken);
        }

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        return api(originalRequest);
      } catch (refreshError) {
        console.warn('[API] Token refresh failed:', refreshError);
        useAuthStore.getState().logout();
        router.replace('/auth');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
