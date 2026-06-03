// File: web/src/hooks/useNotificationSocket.ts
/**
 * WebSocket hook for real-time notifications.
 * Replaces the 30-second polling in Header.tsx.
 *
 * Connects to /ws/notifications/{user_id} and pushes new notifications
 * into the React Query cache so the bell badge updates instantly.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const userId = user.id;

    const connect = () => {
      // Build ws:// URL from the API base
      const apiBase = getApiBaseUrl() || "http://localhost:8000";
      const wsBase = apiBase.replace(/^http/, "ws");
      const wsUrl = `${wsBase}/ws/notifications/${userId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.debug("[NotifWS] Connected");
        // Start keepalive ping every 25 seconds
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "notification") {
            const notif: WsNotification = msg.data;
            // Prepend to the cached notifications list
            qc.setQueryData(
              ["notifications"],
              (old: WsNotification[] | undefined) => {
                if (!old) return [notif];
                // Avoid duplicates
                if (old.some((n) => n.id === notif.id)) return old;
                return [notif, ...old];
              },
            );
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (ev) => {
        console.debug("[NotifWS] Closed", ev.code);
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        // Reconnect after 3s unless it was a clean close (code 1000)
        if (ev.code !== 1000) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, "component unmounted");
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id, qc]);
}
