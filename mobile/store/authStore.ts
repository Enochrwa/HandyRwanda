import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

interface User {
  id: string;
  phone_number: string;
  full_name: string;
  email: string | null;
  role: 'client' | 'artisan' | 'admin';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user, accessToken });
  },
  clearAuth: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
    set({ user: null, accessToken: null });
  },
  initializeAuth: async () => {
    const accessToken = await SecureStore.getItemAsync('access_token');
    const userStr = await SecureStore.getItemAsync('user');
    if (accessToken && userStr) {
      set({ user: JSON.parse(userStr), accessToken });
    }
  },
}));
