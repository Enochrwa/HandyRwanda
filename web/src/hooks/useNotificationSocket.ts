// File: web/src/hooks/useNotificationSocket.ts
/**
 * Socket.IO hook for real-time notifications (web).
 *
 * Connects to the /notifications namespace and pushes new notifications
 * into the React Query cache so the bell badge updates instantly.
 *
 * Auth:       JWT passed in Socket.IO handshake `auth` object — never in URL.
 * Reconnect:  Handled automatically by socket.io-client with exponential
 *             back-off. We only need to manage connect/disconnect lifecycle.
 * Cleanup:    Socket is disconnected when the user logs out or the component
 *             unmounts, preventing memory leaks and stale connections.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";
import { getApiBaseUrl } from "@/services/api";

interface WsNotification {
  id: string;
  event_type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export function useNotificationSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Retrieve the JWT from the auth store / localStorage
    const token = useAuthStore.getState().token ?? "";
    const apiBase = getApiBaseUrl() || "http://localhost:8000";

    const socket = io(`${apiBase}/notifications`, {
      // JWT in auth — NOT in query params / URL (security best practice)
      auth: { token },
      // Prefer WebSocket; fall back to polling if the network blocks upgrades
      transports: ["websocket", "polling"],
      // Automatic reconnect with exponential back-off (socket.io-client default)
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      // Path must match server's socketio_path
      path: "/socket.io",
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.debug("[notifications] Socket.IO connected sid=%s", socket.id);
    });

    socket.on("notification", (payload: { type: string; data: WsNotification }) => {
      if (payload.type !== "notification" || !payload.data) return;
      const notif = payload.data;
      qc.setQueryData(["notifications"], (old: WsNotification[] | undefined) => {
        if (!old) return [notif];
        if (old.some((n) => n.id === notif.id)) return old;
        return [notif, ...old];
      });
    });

    socket.on("connect_error", (err) => {
      console.warn("[notifications] connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.debug("[notifications] disconnected reason=%s", reason);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id, qc]);
}
