// File: mobile/src/store/authStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: 'client' | 'artisan' | 'admin';
  avatarUrl?: string;
  // Full Rwanda address hierarchy
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  streetRoad?: string | null;
  houseNumber?: string | null;
  landmark?: string | null;
  addressDetail?: string | null;
  preferredLang?: string;
  emailVerified?: boolean;
  accountStatus?: 'pending_verification' | 'active' | 'suspended' | 'deactivated';
}

export interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  updateToken: (token: string) => void;
  updateUser: (partial: Partial<User>) => void;
}

/**
 * Decode a JWT exp claim WITHOUT using `atob`.
 * `atob` is a browser API — it is NOT available in React Native's Hermes/JSC.
 * We use a manual base64 decode that works in any JS environment.
 */
const isTokenExpired = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Base64url → standard base64 → pad to multiple of 4
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';

    // Decode using Buffer (available in React Native via the built-in polyfill)
    const json = Buffer.from(base64, 'base64').toString('utf8');
    const { exp } = JSON.parse(json);

    if (typeof exp !== 'number') return false; // no expiry claim → treat as valid
    return exp * 1000 < Date.now();
  } catch {
    // If anything goes wrong parsing the token, treat it as expired to be safe
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

      setAuth: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true }),

      logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),

      updateToken: (token) => set({ token }),

      updateUser: (partial) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...partial } });
      },
    }),
    {
      name: 'hr_auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          console.log('[Auth] Stored token expired — logging out');
          state.logout();
        }
      },
    },
  ),
);
