// File: mobile/src/hooks/useNotificationSocket.ts
/**
 * Real-time WebSocket notification hook for Expo/React Native.
 *
 * Connects to /ws/notifications/{user_id} and pushes new notification
 * payloads into the React Query cache so notification badges update instantly
 * without polling.
 *
 * Handles:
 *  - Auto-reconnect with exponential back-off
 *  - Keepalive pings every 25 seconds
 *  - Background/foreground transitions (reconnects when app comes to foreground)
 *  - React Query cache invalidation on new notification
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { useAuthStore } from '../store/authStore';

const API_BASE = (() => {
  if (Platform.OS === 'android') return 'ws://10.0.2.2:8000';
  return 'ws://localhost:8000';
})();

// In production, derive from your EXPO_PUBLIC_API_URL env var
const WS_BASE = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/^http/, 'ws')
  : API_BASE;

const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

export function useNotificationSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    unmountedRef.current = false;

    const connect = () => {
      if (unmountedRef.current) return;
      const url = `${WS_BASE}/ws/notifications/${user.id}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'notification' && msg.data) {
            const notif = msg.data;
            // Prepend to cache
            qc.setQueryData(['notifications'], (old: (typeof notif)[] | undefined) => {
              if (!old) return [notif];
              if (old.some((n: typeof notif) => n.id === notif.id)) return old;
              return [notif, ...old];
            });
            // Invalidate related queries based on event type
            const et = notif.event_type ?? '';
            if (et.includes('booking') || et.includes('job')) {
              qc.invalidateQueries({ queryKey: ['bookings'] });
            }
            if (et.includes('bid')) {
              qc.invalidateQueries({ queryKey: ['bids'] });
            }
          }
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onclose = (ev) => {
        if (pingRef.current) {
          clearInterval(pingRef.current);
          pingRef.current = null;
        }
        if (!unmountedRef.current && ev.code !== 1000) {
          // Exponential back-off: 1s, 2s, 4s, 8s … max 30s
          const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, MAX_RECONNECT_DELAY_MS);
          reconnectAttemptRef.current += 1;
          reconnectRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    // Re-connect when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          reconnectAttemptRef.current = 0;
          connect();
        }
      }
      appStateRef.current = next;
    });

    return () => {
      unmountedRef.current = true;
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      appStateSub.remove();
      wsRef.current?.close(1000, 'component unmounted');
      wsRef.current = null;
    };
  }, [isAuthenticated, user?.id]);
}
