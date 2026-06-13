// File: mobile/app/(client)/post-job/offline-queue.tsx
// Sprint 13 — Offline Queue Manager Screen
// Shows all queued jobs, lets user post/discard each one, with stale detection

import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';
import { offlineQueue, type QueuedJob } from '../../../src/services/offlineQueue';

function formatRWF(n?: number) {
  if (!n) return '—';
  return new Intl.NumberFormat('rw-RW').format(n);
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 wks',
  monthly: 'Monthly',
};

const STATUS_CONFIG = {
  pending: { color: '#F59E0B', bg: '#FEF3C7', label: '⏳ Queued' },
  uploading: { color: '#3B82F6', bg: '#EFF6FF', label: '📤 Posting…' },
  failed: { color: '#EF4444', bg: '#FEF2F2', label: '❌ Failed' },
};

// ── Job card ──────────────────────────────────────────────────────────────────

function QueuedJobCard({
  job,
  isOnline,
  isPosting,
  onPost,
  onDiscard,
}: {
  job: QueuedJob;
  isOnline: boolean;
  isPosting: boolean;
  onPost: (job: QueuedJob) => void;
  onDiscard: (job: QueuedJob) => void;
}) {
  const hoursAgo = Math.round((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60));
  const isStale = offlineQueue.isStale(job);
  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      exiting={FadeOutUp.duration(200)}
      className={`bg-card rounded-3xl border mb-3 overflow-hidden ${
        isStale ? 'border-amber-300' : job.status === 'failed' ? 'border-red-200' : 'border-border'
      }`}
      style={{ elevation: 2 }}
    >
      {/* Stale banner */}
      {isStale && (
        <View className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-row items-center gap-2">
          <Text className="text-xs font-bold text-amber-800">
            ⏳ Saved {hoursAgo}h ago — still needed?
          </Text>
        </View>
      )}

      <View className="p-4">
        {/* Header row */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center gap-2 flex-wrap mb-1">
              <Text className="font-extrabold text-base text-foreground" numberOfLines={1}>
                {job.payload.title}
              </Text>
              {job.payload.is_recurring && (
                <View className="bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-green-700">
                    🔄 {FREQ_LABELS[job.payload.recurring_frequency ?? 'weekly']}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-muted-foreground" numberOfLines={2}>
              {job.payload.description}
            </Text>
          </View>
          <View
            className="rounded-full px-2.5 py-1 shrink-0"
            style={{ backgroundColor: statusCfg.bg }}
          >
            <Text className="text-[10px] font-bold" style={{ color: statusCfg.color }}>
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View className="flex-row flex-wrap gap-3 mb-3">
          {job.payload.budget && (
            <View className="bg-muted/30 rounded-xl px-3 py-2">
              <Text className="text-[10px] text-muted-foreground font-bold uppercase">Budget</Text>
              <Text className="text-sm font-extrabold text-foreground">
                {formatRWF(job.payload.budget)} RWF
              </Text>
            </View>
          )}
          {job.payload.district && (
            <View className="bg-muted/30 rounded-xl px-3 py-2">
              <Text className="text-[10px] text-muted-foreground font-bold uppercase">
                Location
              </Text>
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                {job.payload.district}
                {job.payload.sector ? `, ${job.payload.sector}` : ''}
              </Text>
            </View>
          )}
          <View className="bg-muted/30 rounded-xl px-3 py-2">
            <Text className="text-[10px] text-muted-foreground font-bold uppercase">Saved</Text>
            <Text className="text-sm font-semibold text-foreground">
              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
            </Text>
          </View>
        </View>

        {/* Photos count */}
        {job.payload.photos_urls && job.payload.photos_urls.length > 0 && (
          <Text className="text-xs text-muted-foreground mb-3">
            📷 {job.payload.photos_urls.length} photo{job.payload.photos_urls.length > 1 ? 's' : ''}{' '}
            attached
          </Text>
        )}

        {/* Error msg */}
        {job.status === 'failed' && job.last_error && (
          <View className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
            <Text className="text-xs text-red-600">⚠️ {job.last_error}</Text>
            {job.retry_count > 0 && (
              <Text className="text-[10px] text-red-400 mt-0.5">
                {job.retry_count}/3 attempts failed
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View className="flex-row gap-2 pt-3 border-t border-border">
          <TouchableOpacity
            onPress={() => onDiscard(job)}
            className="flex-1 border border-border rounded-2xl py-2.5 items-center"
          >
            <Text className="text-xs font-semibold text-muted-foreground">🗑 Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onPost(job)}
            disabled={!isOnline || isPosting}
            className={`flex-[2] rounded-2xl py-2.5 items-center ${
              isOnline ? 'bg-primary' : 'bg-muted'
            }`}
          >
            {isPosting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text
                className={`text-xs font-extrabold ${isOnline ? 'text-white' : 'text-muted-foreground'}`}
              >
                {isOnline ? '📤 Post Now' : '📵 Offline'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OfflineQueueScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [jobs, setJobs] = useState<QueuedJob[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [posting, setPosting] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Load queue
    const unsub = offlineQueue.subscribe(setJobs);
    // Network
    NetInfo.fetch().then((s) => setIsOnline(!!(s.isConnected && s.isInternetReachable)));
    const netUnsub = NetInfo.addEventListener((s) =>
      setIsOnline(!!(s.isConnected && s.isInternetReachable)),
    );
    return () => {
      unsub();
      netUnsub();
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const q = await offlineQueue.getAll();
    setJobs(q);
    setRefreshing(false);
  }, []);

  const handlePostOne = useCallback(
    async (job: QueuedJob) => {
      if (!isOnline) return;
      setPosting(job.id);
      try {
        await offlineQueue.flush(
          api,
          (localId, serverId) => {
            if (localId === job.id) {
              Toast.show({
                type: 'success',
                text1: '✅ Posted!',
                text2: `Job ID: ${serverId.slice(0, 8)}…`,
              });
              qc.invalidateQueries({ queryKey: ['my-jobs'] });
            }
          },
          (localId, error) => {
            if (localId === job.id) {
              Toast.show({ type: 'error', text1: 'Failed to post', text2: error });
            }
          },
        );
      } finally {
        setPosting(null);
      }
    },
    [isOnline, qc],
  );

  const handleDiscard = useCallback((job: QueuedJob) => {
    Alert.alert(
      'Discard this job?',
      `"${job.payload.title}" will be permanently removed from the queue.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await offlineQueue.remove(job.id);
            Toast.show({ type: 'info', text1: 'Job discarded.' });
          },
        },
      ],
    );
  }, []);

  const handleFlushAll = useCallback(async () => {
    if (!isOnline) return;
    setFlushing(true);
    try {
      const result = await offlineQueue.flush(
        api,
        (_, serverId) => {
          qc.invalidateQueries({ queryKey: ['my-jobs'] });
        },
        (_, error) => {
          Toast.show({ type: 'error', text1: 'Some jobs failed', text2: error });
        },
        (staleJob) => {
          Toast.show({
            type: 'info',
            text1: `"${staleJob.payload.title}" is over 24h old`,
            text2: 'Check the queue to decide.',
          });
        },
      );
      if (result.posted > 0) {
        Toast.show({
          type: 'success',
          text1: `✅ ${result.posted} job${result.posted > 1 ? 's' : ''} posted!`,
          text2: result.failed > 0 ? `${result.failed} failed — check the queue.` : undefined,
        });
        qc.invalidateQueries({ queryKey: ['my-jobs'] });
      }
    } finally {
      setFlushing(false);
    }
  }, [isOnline, qc]);

  const pendingCount = jobs.filter((j) => j.status === 'pending' || j.status === 'failed').length;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-14 pb-6 px-6 rounded-b-[32px]">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-white/70 text-sm">← Back</Text>
        </TouchableOpacity>
        <Text className="text-white text-xl font-extrabold">📶 Offline Queue</Text>
        <Text className="text-white/70 text-xs mt-1">
          {pendingCount} job{pendingCount !== 1 ? 's' : ''} waiting to post
        </Text>

        {/* Network status */}
        <View
          className={`mt-3 flex-row items-center gap-2 rounded-full px-3 py-1.5 self-start ${
            isOnline ? 'bg-white/20' : 'bg-red-500/30'
          }`}
        >
          <View className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-300' : 'bg-red-400'}`} />
          <Text className="text-white text-xs font-semibold">
            {isOnline ? 'Online — ready to post' : 'Offline — connect to post'}
          </Text>
        </View>
      </View>

      {jobs.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-5xl mb-4">✅</Text>
          <Text className="font-extrabold text-xl text-foreground mb-2">Queue is empty</Text>
          <Text className="text-sm text-muted-foreground text-center px-10">
            No jobs waiting to sync. When you create jobs offline, they appear here.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(client)/post-job')}
            className="mt-6 bg-primary rounded-2xl px-8 py-3.5"
          >
            <Text className="text-white font-extrabold">Post a Job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Post all button */}
          {pendingCount > 1 && isOnline && (
            <View className="px-4 pt-4">
              <TouchableOpacity
                onPress={handleFlushAll}
                disabled={flushing}
                className="bg-primary rounded-2xl py-3.5 flex-row items-center justify-center gap-2"
              >
                {flushing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Text className="text-white font-extrabold text-sm">
                      📤 Post All {pendingCount} Jobs
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#1B5E3B"
              />
            }
            renderItem={({ item }) => (
              <QueuedJobCard
                job={item}
                isOnline={isOnline}
                isPosting={posting === item.id}
                onPost={handlePostOne}
                onDiscard={handleDiscard}
              />
            )}
          />
        </>
      )}
    </View>
  );
}
