// File: mobile/src/services/offlineQueue.ts
// Sprint 13 — Offline-First Job Posting
//
// Provides a persistent queue backed by AsyncStorage.
// When the device reconnects, flush() posts all pending jobs to the API.

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { AxiosInstance } from 'axios';

const QUEUE_KEY = '@handy_offline_job_queue';
const MAX_RETRY = 3;
const STALE_HOURS = 24;

/** RFC-4122 v4 UUID using Math.random (sufficient for local queue IDs). */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobCreatePayload {
  category_id: string;
  title: string;
  description: string;
  additional_notes?: string;
  budget?: number;
  budget_negotiable?: boolean;
  urgency?: string;
  photos_urls?: string[];
  scheduled_time?: string;
  // Address
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  street_road?: string;
  house_number?: string;
  landmark?: string;
  location_label?: string;
  latitude?: number;
  longitude?: number;
  // Sprint 12 recurring
  is_recurring?: boolean;
  recurring_frequency?: string;
  recurring_day_of_week?: number;
  recurring_day_of_month?: number;
  recurring_prefer_same_artisan?: boolean;
}

export type QueuedJobStatus = 'pending' | 'uploading' | 'failed';

export interface QueuedJob {
  id: string; // local UUID
  payload: JobCreatePayload;
  created_at: string; // ISO timestamp
  status: QueuedJobStatus;
  retry_count: number;
  last_error?: string;
}

export type QueueChangeListener = (jobs: QueuedJob[]) => void;

// ── Internal storage helpers ──────────────────────────────────────────────────

async function _read(): Promise<QueuedJob[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedJob[]) : [];
  } catch {
    return [];
  }
}

async function _write(jobs: QueuedJob[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(jobs));
}

// ── Listeners for UI reactivity ───────────────────────────────────────────────

const _listeners = new Set<QueueChangeListener>();

function _emit(jobs: QueuedJob[]): void {
  _listeners.forEach((l) => l(jobs));
}

// ── Public API ────────────────────────────────────────────────────────────────

export const offlineQueue = {
  // Subscribe to queue changes (e.g., badge count)
  subscribe(listener: QueueChangeListener): () => void {
    _listeners.add(listener);
    // Emit current state immediately
    _read().then(_emit);
    return () => _listeners.delete(listener);
  },

  async add(payload: JobCreatePayload): Promise<string> {
    const id = uuidv4();
    const job: QueuedJob = {
      id,
      payload,
      created_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
    };
    const jobs = await _read();
    jobs.push(job);
    await _write(jobs);
    _emit(jobs);
    return id;
  },

  async getAll(): Promise<QueuedJob[]> {
    return _read();
  },

  async remove(id: string): Promise<void> {
    const jobs = (await _read()).filter((j) => j.id !== id);
    await _write(jobs);
    _emit(jobs);
  },

  async getPendingCount(): Promise<number> {
    const jobs = await _read();
    return jobs.filter((j) => j.status === 'pending' || j.status === 'failed').length;
  },

  // Check if a queued job is stale (> 24h old)
  isStale(job: QueuedJob): boolean {
    const age = Date.now() - new Date(job.created_at).getTime();
    return age > STALE_HOURS * 60 * 60 * 1000;
  },

  // Flush: post all pending jobs. Called on reconnect.
  async flush(
    apiClient: AxiosInstance,
    onJobPosted?: (jobId: string, serverId: string) => void,
    onJobFailed?: (jobId: string, error: string) => void,
    onStaleDetected?: (job: QueuedJob) => void,
  ): Promise<{ posted: number; failed: number; stale: number }> {
    const jobs = await _read();
    const pending = jobs.filter((j) => j.status === 'pending' || j.status === 'failed');

    let posted = 0;
    let failed = 0;
    let stale = 0;

    for (const job of pending) {
      // Sprint 13.3: stale detection
      if (offlineQueue.isStale(job)) {
        stale++;
        onStaleDetected?.(job);
        continue; // let caller decide whether to discard
      }

      // Mark as uploading
      await _updateStatus(job.id, 'uploading');

      try {
        let serverId: string;

        if (job.payload.is_recurring) {
          // Sprint 12: post as recurring schedule
          const {
            is_recurring,
            recurring_frequency,
            recurring_day_of_week,
            recurring_day_of_month,
            recurring_prefer_same_artisan,
            ...rest
          } = job.payload;
          const res = await apiClient.post('/recurring', {
            ...rest,
            frequency: recurring_frequency ?? 'weekly',
            day_of_week: recurring_day_of_week,
            day_of_month: recurring_day_of_month,
            budget_per_session: rest.budget,
          });
          serverId = res.data.id;
        } else {
          // Sprint 13: use the idempotent sync endpoint
          const res = await apiClient.post('/jobs/sync-offline-draft', job.payload);
          serverId = res.data.id;
        }

        await offlineQueue.remove(job.id);
        onJobPosted?.(job.id, serverId);
        posted++;
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Network error';
        failed++;
        const newRetry = job.retry_count + 1;
        if (newRetry >= MAX_RETRY) {
          // Give up after 3 retries
          await _updateStatus(job.id, 'failed', msg);
        } else {
          await _updateJobFields(job.id, {
            status: 'failed',
            retry_count: newRetry,
            last_error: msg,
          });
        }
        onJobFailed?.(job.id, msg);
      }
    }

    const remaining = await _read();
    _emit(remaining);
    return { posted, failed, stale };
  },
};

async function _updateStatus(id: string, status: QueuedJobStatus, error?: string): Promise<void> {
  await _updateJobFields(id, { status, ...(error ? { last_error: error } : {}) });
}

async function _updateJobFields(id: string, fields: Partial<QueuedJob>): Promise<void> {
  const jobs = await _read();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx !== -1) {
    jobs[idx] = { ...jobs[idx], ...fields };
    await _write(jobs);
    _emit(jobs);
  }
}

// ── Auto-flush on reconnect ───────────────────────────────────────────────────
// Called once at app startup. Registers a NetInfo listener.

export function initOfflineQueueAutoFlush(
  apiClient: AxiosInstance,
  callbacks?: {
    onPosted?: (localId: string, serverId: string) => void;
    onFailed?: (localId: string, error: string) => void;
    onStaleDetected?: (job: QueuedJob) => void;
  },
): () => void {
  let wasOffline = false;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = state.isConnected && state.isInternetReachable;

    if (isOnline && wasOffline) {
      // Just came back online — flush
      offlineQueue
        .flush(apiClient, callbacks?.onPosted, callbacks?.onFailed, callbacks?.onStaleDetected)
        .catch(() => {
          /* silent */
        });
    }

    wasOffline = !isOnline;
  });

  return unsubscribe;
}
