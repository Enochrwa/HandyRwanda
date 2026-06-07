// File: mobile/src/hooks/useMessageSocket.ts
/**
 * Socket.IO hook for real-time chat messages (React Native / Expo).
 *
 * Connects to the /messages namespace and joins a booking room.
 * Incoming "message" events from the OTHER participant are merged into
 * the React Query cache so the chat view updates instantly.
 *
 * Usage:
 *   const { connected } = useMessageSocket(bookingId);
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_BASE_URL } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  booking_id?: string;
}

interface UseMessageSocketReturn {
  connected: boolean;
}

export function useMessageSocket(bookingId: string | undefined): UseMessageSocketReturn {
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const bookingIdRef = useRef<string | undefined>(undefined);

  const joinRoom = useCallback((socket: Socket, bid: string) => {
    socket.emit('join', { booking_id: bid });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !bookingId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const token = useAuthStore.getState().token ?? '';

    // Re-use existing connected socket; only switch rooms if booking changed
    if (socketRef.current?.connected) {
      if (bookingIdRef.current !== bookingId) {
        if (bookingIdRef.current) {
          socketRef.current.emit('leave', { booking_id: bookingIdRef.current });
        }
        bookingIdRef.current = bookingId;
        joinRoom(socketRef.current, bookingId);
      }
      return;
    }

    const socket = io(`${API_BASE_URL}/messages`, {
      auth: { token, booking_id: bookingId },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      path: '/socket.io',
      forceNew: true,
    });

    socketRef.current = socket;
    bookingIdRef.current = bookingId;

    socket.on('connect', () => {
      setConnected(true);
      console.debug('[messages] Socket.IO connected sid=%s booking=%s', socket.id, bookingId);
      joinRoom(socket, bookingId);
    });

    socket.on('joined', (data: { booking_id: string }) => {
      console.debug('[messages] joined room booking:%s', data.booking_id);
    });

    socket.on('message', (msg: ChatMessage) => {
      // Merge incoming message into cache
      qc.setQueryData(['messages', bookingId], (old: ChatMessage[] | undefined) => {
        const list = old ?? [];
        if (list.some((m) => m.id === msg.id)) return list;
        return [...list, msg];
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('disconnect', (reason: string) => {
      setConnected(false);
      console.debug('[messages] disconnected reason=%s', reason);
    });

    socket.on('connect_error', (err: Error) => {
      console.warn('[messages] connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      bookingIdRef.current = undefined;
      setConnected(false);
    };
  }, [isAuthenticated, bookingId, qc, joinRoom]);

  return { connected };
}
