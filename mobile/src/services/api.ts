import axios from 'axios';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';

// In production, this would come from an environment variable
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
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
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token } = response.data;

          const user = useAuthStore.getState().user;
          if (user) {
            useAuthStore.getState().setAuth(user, access_token, refreshToken);
          }

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          router.replace('/');
          return Promise.reject(refreshError);
        }
      } else {
        useAuthStore.getState().logout();
        router.replace('/');
      }
    }
    return Promise.reject(error);
  },
);

export default api;
