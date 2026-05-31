// File: mobile/src/navigation.ts
import { router } from 'expo-router';

/** True when the user is already on the auth screen (avoid duplicate redirects). */
export function isOnAuthRoute(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth?');
}

export function navigateToAuth(mode: 'login' | 'register' = 'login') {
  router.push(mode === 'register' ? '/auth?mode=register' : '/auth');
}
