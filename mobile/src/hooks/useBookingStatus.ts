// File: mobile/src/hooks/useBookingStatus.ts
/**
 * Sprint 1 — Real-Time Booking Status Hook
 *
 * Subscribes to the /notifications Socket.IO namespace and listens for
 * `booking_status_change` events for a specific bookingId.
 *
 * Returns:
 *   - `status`       — latest BookingStatus string (from API or WS)
 *   - `etaMinutes`   — ETA in minutes if artisan is en route
 *   - `artisanName`  — artisan's full name (from WS payload)
 *   - `connected`    — whether the live connection is active
 *   - `lastUpdatedAt` — ISO timestamp of the last status change
 *
 * Usage:
 *   const { status, etaMinutes, connected } = useBookingStatus(bookingId, initialStatus);
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';

import { API_BASE_URL } from '../services/api';
import { useAuthStore } from '../store/authStore';

export type BookingStatusValue =
  | 'pending_payment'
  | 'confirmed'
  | 'artisan_accepted'
  | 'artisan_en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'cancelled_no_response';

export interface BookingStatusState {
  status: BookingStatusValue | null;
  etaMinutes: number | null;
  artisanName: string;
  clientName: string;
  connected: boolean;
  lastUpdatedAt: string | null;
}

export function useBookingStatus(
  bookingId: string | undefined,
  initialStatus?: BookingStatusValue | null,
): BookingStatusState {
  const { isAuthenticated, user } = useAuthStore();
  const qc = useQueryClient();

  const [state, setState] = useState<BookingStatusState>({
    status: initialStatus ?? null,
    etaMinutes: null,
    artisanName: '',
    clientName: '',
    connected: false,
    lastUpdatedAt: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !bookingId) return;
    unmountedRef.current = false;

    const token = useAuthStore.getState().token ?? '';

    const connect = () => {
      if (unmountedRef.current) return;
      socketRef.current?.disconnect();

      const socket = io(`${API_BASE_URL}/notifications`, {
        auth: { token },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30_000,
        path: '/socket.io',
        forceNew: false, // reuse existing connection if available
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (!unmountedRef.current) {
          setState((s) => ({ ...s, connected: true }));
        }
      });

      socket.on('disconnect', () => {
        if (!unmountedRef.current) {
          setState((s) => ({ ...s, connected: false }));
        }
      });

      socket.on('connect_error', () => {
        if (!unmountedRef.current) {
          setState((s) => ({ ...s, connected: false }));
        }
      });

      /**
       * The backend pushes events in the format:
       * {
       *   type: "booking_status_change",
       *   booking_id: "...",
       *   new_status: "artisan_en_route",
       *   artisan_name: "Jean Baptiste",
       *   eta_minutes: 20,
       *   timestamp: "2025-06-07T..."
       * }
       *
       * These arrive wrapped in the Socket.IO "notification" event.
       */
      socket.on('notification', (payload: { type: string; data: any }) => {
        if (!payload || !payload.data) return;

        const data = payload.data;

        // Handle booking_status_change events for THIS booking
        if (
          data.type === 'booking_status_change' &&
          data.booking_id === bookingId
        ) {
          if (!unmountedRef.current) {
            setState((s) => ({
              ...s,
              status: data.new_status ?? s.status,
              etaMinutes: data.eta_minutes ?? null,
              artisanName: data.artisan_name ?? s.artisanName,
              clientName: data.client_name ?? s.clientName,
              lastUpdatedAt: data.timestamp ?? new Date().toISOString(),
            }));
          }

          // Invalidate React Query caches so UI re-fetches fresh data
          qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
          qc.invalidateQueries({ queryKey: ['bookings'] });
          qc.invalidateQueries({ queryKey: ['upcomingBookings'] });
        }
      });
    };

    connect();

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      if (wasBackground && next === 'active' && !socketRef.current?.connected) {
        connect();
      }
      appStateRef.current = next;
    });

    return () => {
      unmountedRef.current = true;
      appStateSub.remove();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id, bookingId, qc]);

  return state;
}
