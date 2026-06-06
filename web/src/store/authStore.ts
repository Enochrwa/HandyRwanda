// File: web/src/store/authStore.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: "client" | "artisan" | "admin";
  avatarUrl?: string;
  accountStatus?: "pending_verification" | "active" | "suspended" | "deactivated";
  emailVerified?: boolean;
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

const isTokenExpired = (token: string): boolean => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const { exp } = JSON.parse(jsonPayload);
    return exp * 1000 < Date.now();
  } catch {
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
      name: "hr_auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.logout();
        }
      },
    },
  ),
);
