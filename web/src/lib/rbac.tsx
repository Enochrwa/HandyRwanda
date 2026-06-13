/**
 * RBAC — Role-Based Access Control helpers
 *
 * Three user roles exist in HandyRwanda:
 *   - client   → can post jobs, book artisans, message, use referrals
 *   - artisan  → can view job feed, bid on jobs, manage bookings, message
 *   - admin    → full dashboard access (verification, users, disputes, analytics)
 *
 * Unauthenticated visitors can browse artisans and the landing page only.
 *
 * Non-component exports (hooks, types, constants) live in rbac-utils.ts to
 * satisfy the react-refresh/only-export-components rule.
 */

import React from "react";
import { useRequireAuth, useRequireRole } from "./rbac-utils";
export type { UserRole } from "./rbac-utils";

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
  allowedRoles: Array<"client" | "artisan" | "admin">;
}

/**
 * Wrap a page component to require a specific role.
 * Shows `fallback` (default: AccessDenied banner) while redirecting.
 */
export function RoleGuard({ children, allowedRoles, fallback, redirectTo = "/" }: RoleGuardProps) {
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
