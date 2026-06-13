/**
 * RBAC — Role-Based Access Control helpers
 *
 * Three user roles exist in HandyRwanda:
 *   - client   → can post jobs, book artisans, message, use referrals
 *   - artisan  → can view job feed, bid on jobs, manage bookings, message
 *   - admin    → full dashboard access (verification, users, disputes, analytics)
 *
 * Unauthenticated visitors can browse artisans and the landing page only.
 */

import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";

export type UserRole = "client" | "artisan" | "admin";

// ── Route guard hooks ────────────────────────────────────────────────────────

/**
 * Redirects unauthenticated users to `/`.
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

// ── Guard wrapper components ─────────────────────────────────────────────────

interface AuthGuardProps {
  children: React.ReactNode;
  /** Fallback while redirecting (default: null / blank) */
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * Wrap a page component to require authentication.
 * Renders `fallback` while the redirect fires so the page never flashes.
 */
export function AuthGuard({ children, fallback = null, redirectTo = "/" }: AuthGuardProps) {
  const passed = useRequireAuth(redirectTo);
  if (!passed) return <>{fallback}</>;
  return <>{children}</>;
}

interface RoleGuardProps extends AuthGuardProps {
  allowedRoles: UserRole[];
}

/**
 * Wrap a page component to require a specific role.
 * Shows `fallback` (default: AccessDenied banner) while redirecting.
 */
export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  redirectTo = "/",
}: RoleGuardProps) {
  const passed = useRequireRole(allowedRoles, redirectTo);
  if (!passed)
    return (
      <>
        {fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="text-center">
              <p className="text-4xl font-black text-primary">403</p>
              <p className="mt-2 text-sm text-muted-foreground">Access denied — redirecting…</p>
            </div>
          </div>
        )}
      </>
    );
  return <>{children}</>;
}

// ── Permission helpers ────────────────────────────────────────────────────────

export const can = {
  /** Only clients post jobs */
  postJob: (role?: string) => role === "client",

  /** Only artisans see job feed and submit bids */
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

  /** Artisans manage their own bookings */
  manageBookings: (role?: string) => role === "artisan" || role === "client",
};
