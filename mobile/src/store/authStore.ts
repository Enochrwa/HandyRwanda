import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: 'client' | 'artisan';
  avatarUrl?: string | null;
}

export interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
}

// Simple atob polyfill for React Native
const atob = (input: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = input.replace(/=+$/, '');
  let output = '';

  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }

  for (
    let bc = 0, bs = 0, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }

  return output;
};

const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const payloadBase64 = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
    const exp = decodedPayload.exp;
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch (error) {
    return true;
  }
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, token, refreshToken) => {
        set({ user, token, refreshToken, isAuthenticated: !!token });
      },
      logout: () => {
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'hr_auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.logout();
        } else if (state?.token) {
          state.setAuth(state.user!, state.token, state.refreshToken!);
        }
      },
    },
  ),
);
