// File: mobile/src/hooks/useNotificationSocket.ts
/**
 * Socket.IO hook for real-time notifications (React Native / Expo).
 *
 * Connects to the /notifications namespace and pushes new notification
 * payloads into the React Query cache so notification badges update instantly
 * without polling.
 *
 * Key differences from web version:
 *  - Uses React Native's AppState API to reconnect when foregrounded
 *  - Forces polling transport first for Android WebView compatibility,
 *    then upgrades to WebSocket (react-native doesn't support WS upgrades
 *    from within some network environments)
 *  - Auth token is passed in Socket.IO handshake `auth` object
 *
 * Handles:
 *  - Auto-reconnect (delegated to socket.io-client built-in back-off)
 *  - Background/foreground transitions
 *  - React Query cache invalidation on new notification
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';

import { API_BASE_URL } from '../services/api';
import { useAuthStore } from '../store/authStore';

export function useNotificationSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    unmountedRef.current = false;

    const token = useAuthStore.getState().token ?? '';

    const connect = () => {
      if (unmountedRef.current) return;
      // Disconnect stale socket if any
      socketRef.current?.disconnect();

      const socket = io(`${API_BASE_URL}/notifications`, {
        auth: { token },
        // On React Native, start with polling then upgrade to websocket.
        // Some Android network stacks block direct WS upgrades.
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30_000,
        path: '/socket.io',
        forceNew: true,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.debug('[notifications] Socket.IO connected sid=%s', socket.id);
      });

      socket.on('notification', (payload: { type: string; data: any }) => {
        if (payload.type !== 'notification' || !payload.data) return;
        const notif = payload.data;
        qc.setQueryData(['notifications'], (old: any[] | undefined) => {
          if (!old) return [notif];
          if (old.some((n: any) => n.id === notif.id)) return old;
          return [notif, ...old];
        });
        // Invalidate related queries based on event type
        const et: string = notif.event_type ?? '';
        if (et.includes('booking') || et.includes('job')) {
          qc.invalidateQueries({ queryKey: ['bookings'] });
        }
        if (et.includes('bid')) {
          qc.invalidateQueries({ queryKey: ['bids'] });
        }
      });

      socket.on('connect_error', (err) => {
        console.warn('[notifications] connection error:', err.message);
      });

      socket.on('disconnect', (reason) => {
        console.debug('[notifications] disconnected reason=%s', reason);
      });
    };

    connect();

    // Re-connect when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      if (wasBackground && next === 'active') {
        if (!socketRef.current?.connected) {
          connect();
        }
      }
      appStateRef.current = next;
    });

    return () => {
      unmountedRef.current = true;
      appStateSub.remove();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id, qc]);
}
