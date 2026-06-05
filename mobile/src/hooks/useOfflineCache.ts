// File: mobile/src/hooks/useOfflineCache.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

const CACHE_PREFIX = 'hr_cache_';
const QUEUE_KEY = 'hr_offline_queue';

export interface OfflineAction {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?: unknown;
  timestamp: number;
}

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const NetInfo = await import('@react-native-community/netinfo');
        unsubscribe = NetInfo.default.addEventListener((state) => {
          const online = !!(state.isConnected && state.isInternetReachable !== false);
          setIsOnline((prev) => {
            if (!prev && online) {
              flushOfflineQueue();
              qc.invalidateQueries({ queryKey: ['bookings'] });
              qc.invalidateQueries({ queryKey: ['notifications'] });
            }
            return online;
          });
        });
      } catch {
        /* NetInfo unavailable */
      }
    })();
    return () => {
      unsubscribe?.();
    };
  }, [qc]);

  return { isOnline };
}

export async function cacheData(key: string, data: unknown) {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* non-fatal */
  }
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw).data as T;
  } catch {
    return null;
  }
}

export async function queueOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: OfflineAction[] = raw ? JSON.parse(raw) : [];
    queue.push({ ...action, id: Math.random().toString(36).slice(2), timestamp: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* non-fatal */
  }
}

async function flushOfflineQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue: OfflineAction[] = JSON.parse(raw);
    if (!queue.length) return;
    const { default: api } = await import('../services/api');
    const ok: string[] = [];
    for (const action of queue) {
      try {
        await api.request({ url: action.url, method: action.method, data: action.data });
        ok.push(action.id);
      } catch {
        /* keep in queue */
      }
    }
    const remaining = queue.filter((a) => !ok.includes(a.id));
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    /* non-fatal */
  }
}
