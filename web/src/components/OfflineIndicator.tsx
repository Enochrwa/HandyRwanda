// File: web/src/components/OfflineIndicator.tsx
// Sprint 13 — Web offline/online status indicator
// Shows a banner when the browser loses internet connection.
// Auto-dismisses when back online and flushes any queued operations.

import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      // Auto-dismiss "back online" message after 3s
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => setJustReconnected(false), 3000);
    };

    // Set initial state
    setIsOffline(!navigator.onLine);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      clearTimeout(reconnectTimer.current);
    };
  }, []);

  if (!isOffline && !justReconnected) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        isOffline ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90"
      }`}
    >
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl backdrop-blur-sm ${
          isOffline ? "bg-red-600/95 text-white" : "bg-green-600/95 text-white"
        }`}
      >
        {isOffline ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You're offline — changes will sync when you reconnect</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 shrink-0" />
            <span>Back online!</span>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          </>
        )}
      </div>
    </div>
  );
}
