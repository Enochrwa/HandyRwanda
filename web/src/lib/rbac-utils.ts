/**
 * RBAC utilities — hooks, types, and permission helpers.
 * Kept in a separate .ts file so rbac.tsx can satisfy
 * react-refresh/only-export-components (components-only file).
 */

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";

export type UserRole = "client" | "artisan" | "admin";

// ── Route guard hooks ────────────────────────────────────────────────────────

/**
 * Redirects unauthenticated users to `redirectTo`.
 * Safe to call inside any React component — no hook-order violation.
 */
export function useRequireAuth(redirectTo = "/") {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: redirectTo });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  return isAuthenticated;
}

/**
 * Redirects users whose role is NOT in `allowedRoles`.
 * Returns true once the guard passes (user is authenticated + has a valid role).
 */
export function useRequireRole(allowedRoles: UserRole[], redirectTo = "/") {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: redirectTo });
      return;
    }
    if (user && !allowedRoles.includes(user.role as UserRole)) {
      navigate({ to: redirectTo });
    }
  }, [isAuthenticated, user, navigate, redirectTo, allowedRoles]);

  if (!isAuthenticated || !user) return false;
  return allowedRoles.includes(user.role as UserRole);
}

// ── Permission helpers ────────────────────────────────────────────────────────

export const can = {
  /** Only clients post jobs */
  postJob: (role?: string) => role === "client",

  /** Only artisans see the job feed and submit bids */
  viewJobFeed: (role?: string) => role === "artisan",
  submitBid: (role?: string) => role === "artisan",

  /** Both clients and artisans use messaging */
  useMessages: (role?: string) => role === "client" || role === "artisan",

  /** All authenticated users use referrals */
  useReferrals: (role?: string) => !!role,

  /** Admin-only */
  accessAdmin: (role?: string) => role === "admin",

  /** Clients book artisans */
  bookArtisan: (role?: string) => role === "client",

  /** Artisans and clients manage bookings */
  manageBookings: (role?: string) => role === "artisan" || role === "client",
};
