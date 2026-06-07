// File: web/src/hooks/useMessageSocket.ts
/**
 * Socket.IO hook for real-time chat messages (web).
 *
 * Connects to the /messages namespace and joins a booking room.
 * Incoming "message" events are appended to the React Query cache so the
 * chat view updates instantly without polling.
 *
 * Usage:
 *   const { sendSocketMessage, connected } = useMessageSocket(bookingId);
 *
 * The hook manages:
 *   - Connect / join booking room on mount
 *   - Leave old room / join new room when bookingId changes
 *   - Disconnect cleanly on unmount
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";
import { getApiBaseUrl } from "@/services/api";

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  booking_id?: string;
}

interface UseMessageSocketReturn {
  /** Whether the socket is currently connected */
  connected: boolean;
  /**
   * Emit a locally-composed message to the booking room.
   * Use AFTER persisting via REST so the server is the source of truth.
   */
  sendSocketMessage: (msg: ChatMessage) => void;
}

export function useMessageSocket(bookingId: string | undefined): UseMessageSocketReturn {
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const bookingIdRef = useRef<string | undefined>(undefined);

  // Stable reference to the booking-room join helper
  const joinRoom = useCallback((socket: Socket, bid: string) => {
    socket.emit("join", { booking_id: bid });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !bookingId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const token = useAuthStore.getState().token ?? "";
    const apiBase = getApiBaseUrl() || "http://localhost:8000";

    // Re-use existing socket if already connected; only join a different room
    if (socketRef.current?.connected) {
      if (bookingIdRef.current !== bookingId) {
        // Leave old room first
        if (bookingIdRef.current) {
          socketRef.current.emit("leave", { booking_id: bookingIdRef.current });
        }
        bookingIdRef.current = bookingId;
        joinRoom(socketRef.current, bookingId);
      }
      return;
    }

    const socket = io(`${apiBase}/messages`, {
      auth: { token, booking_id: bookingId },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      path: "/socket.io",
    });

    socketRef.current = socket;
    bookingIdRef.current = bookingId;

    socket.on("connect", () => {
      setConnected(true);
      console.debug("[messages] Socket.IO connected sid=%s booking=%s", socket.id, bookingId);
      // Ensure we're in the right room (handles reconnects)
      joinRoom(socket, bookingId);
    });

    socket.on("joined", (data: { booking_id: string }) => {
      console.debug("[messages] joined room booking:%s", data.booking_id);
    });

    socket.on("message", (msg: ChatMessage) => {
      // Append incoming messages from OTHER participants to the cache
      qc.setQueryData(["messages", bookingId], (old: ChatMessage[] | undefined) => {
        const list = old ?? [];
        if (list.some((m) => m.id === msg.id)) return list;
        return [...list, msg];
      });
      // Bump conversation list unread counts
      qc.invalidateQueries({ queryKey: ["conversations"] });
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.debug("[messages] disconnected reason=%s", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[messages] connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      bookingIdRef.current = undefined;
      setConnected(false);
    };
  }, [isAuthenticated, bookingId, qc, joinRoom]);

  const sendSocketMessage = useCallback(
    (msg: ChatMessage) => {
      // Nothing to broadcast — the server already emitted to the room
      // when the REST POST was handled. This is a no-op kept for API compat.
      void msg;
    },
    [],
  );

  return { connected, sendSocketMessage };
}
