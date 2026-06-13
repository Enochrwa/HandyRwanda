// File: mobile/app/(client)/post-job/confirm.tsx
// Sprint 12: Recurring job posting path
// Sprint 13: Offline-first job posting with queue + stale detection

import NetInfo from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';
import { uploadImage } from '../../../src/services/imageUpload';
import {
  offlineQueue,
  type JobCreatePayload,
  type QueuedJob,
} from '../../../src/services/offlineQueue';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

const URGENCY_LABELS: Record<string, string> = {
  flexible: '📅 Flexible (within 2 weeks)',
  this_week: '🗓️ This Week (within 7 days)',
  tomorrow: '⏰ Tomorrow (within 24h)',
  today: '🔥 Today',
  urgent: '🚨 Urgent (within 2 hours)',
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
};

// ── Stale dialog ──────────────────────────────────────────────────────────────

function StaleJobDialog({
  job,
  visible,
  onPost,
  onDiscard,
}: {
  job: QueuedJob | null;
  visible: boolean;
  onPost: () => void;
  onDiscard: () => void;
}) {
  if (!job) return null;
  const hoursAgo = Math.round((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60));
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            width: '100%',
            maxWidth: 380,
          }}
        >
          <Text style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>⏳</Text>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '800',
              color: '#111827',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Job waiting {hoursAgo}h
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            <Text style={{ fontWeight: '700', color: '#111827' }}>"{job.payload.title}"</Text> was
            saved offline. Is this job still needed?
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onDiscard}
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderColor: '#E5E7EB',
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#EF4444', fontSize: 14 }}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPost}
              style={{
                flex: 1,
                backgroundColor: '#1B5E3B',
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '800', color: '#FFFFFF', fontSize: 14 }}>Post It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Offline badge ─────────────────────────────────────────────────────────────

function OfflineBadge({ count }: { count: number }) {
  const scale = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 6,
      }).start();
    } else {
      Animated.spring(scale, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [count, scale]);

  if (count === 0) return null;

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        backgroundColor: '#F59E0B',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 13 }}>📶</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
        {count} job{count !== 1 ? 's' : ''} queued — will post when online
      </Text>
    </Animated.View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConfirmJob() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<Record<string, string>>();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [staleJob, setStaleJob] = useState<QueuedJob | null>(null);

  // Sprint 12 params
  const isRecurring = params.isRecurring === '1';
  const recurringFrequency = params.recurringFrequency ?? 'weekly';
  const recurringDayOfWeek = parseInt(params.recurringDayOfWeek ?? '5', 10);
  const recurringDayOfMonth = parseInt(params.recurringDayOfMonth ?? '1', 10);
  const recurringPreferSameArtisan = params.recurringPreferSameArtisan === '1';

  const { data: allCategories = [] } = useQuery<
    { id: string; name_en: string; icon_emoji?: string }[]
  >({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });
  const category = allCategories.find((c) => c.id === params.categoryId) ?? null;
  const budget = params.budget ? parseInt(params.budget, 10) : null;
  const photoUris: string[] = JSON.parse(params.photos ?? '[]');

  // ── Network state ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Initial check
    NetInfo.fetch().then((s) => setIsOnline(!!(s.isConnected && s.isInternetReachable)));

    const unsub = NetInfo.addEventListener((s) => {
      const online = !!(s.isConnected && s.isInternetReachable);
      setIsOnline(online);

      if (online) {
        // Auto-flush queue on reconnect
        _flushQueue(false);
      }
    });
    return () => unsub();
  }, []);

  // ── Queue badge ────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = offlineQueue.subscribe((jobs) => {
      setQueuedCount(jobs.filter((j) => j.status === 'pending' || j.status === 'failed').length);
    });
    return () => unsub();
  }, []);

  // ── Flush ──────────────────────────────────────────────────────────────────

  const _flushQueue = useCallback(
    async (showToasts = true) => {
      const result = await offlineQueue.flush(
        api,
        (_, serverId) => {
          if (showToasts) {
            Toast.show({
              type: 'success',
              text1: '✅ Queued job posted!',
              text2: `Job ID: ${serverId.slice(0, 8)}…`,
            });
          }
          qc.invalidateQueries({ queryKey: ['my-jobs'] });
        },
        (_, error) => {
          if (showToasts) {
            Toast.show({ type: 'error', text1: 'Failed to post queued job', text2: error });
          }
        },
        (job) => {
          setStaleJob(job);
        },
      );
      return result;
    },
    [qc],
  );

  // ── Build payload ──────────────────────────────────────────────────────────

  const buildPayload = (uploadedPhotoUrls: string[]): JobCreatePayload => {
    let parsedAddress: Record<string, string> = {};
    try {
      parsedAddress = params.addressJson ? JSON.parse(params.addressJson) : {};
    } catch {
      /* ignore */
    }

    return {
      category_id: params.categoryId ?? '',
      title: params.title ?? '',
      description: params.description ?? '',
      additional_notes: params.additionalNotes || undefined,
      latitude: parseFloat(params.latitude ?? '-1.9441'),
      longitude: parseFloat(params.longitude ?? '30.0619'),
      location_label: params.locationLabel ?? 'Custom Location',
      urgency: params.urgency ?? 'flexible',
      budget_negotiable: params.budgetNegotiable === '1',
      ...(parsedAddress.district
        ? {
            district: parsedAddress.district,
            sector: parsedAddress.sector,
            province: parsedAddress.province,
            cell: parsedAddress.cell,
            village: parsedAddress.village,
          }
        : {}),
      ...(params.scheduledTime ? { scheduled_time: params.scheduledTime } : {}),
      ...(budget ? { budget } : {}),
      ...(uploadedPhotoUrls.length > 0 ? { photos_urls: uploadedPhotoUrls } : {}),
      // Sprint 12
      is_recurring: isRecurring,
      ...(isRecurring
        ? {
            recurring_frequency: recurringFrequency,
            recurring_day_of_week: recurringDayOfWeek,
            recurring_day_of_month: recurringDayOfMonth,
            recurring_prefer_same_artisan: recurringPreferSameArtisan,
          }
        : {}),
    };
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Upload photos (always attempt even offline, they may succeed on LAN)
      const uploadedPhotoUrls: string[] = [];
      if (photoUris.length > 0 && isOnline) {
        setUploadProgress('Uploading photos…');
        for (let i = 0; i < photoUris.length; i++) {
          setUploadProgress(`Uploading photo ${i + 1}/${photoUris.length}…`);
          try {
            const result = await uploadImage(photoUris[i], 'job_photo', true, `job_photo_${i}.jpg`);
            uploadedPhotoUrls.push(result.publicUrl);
          } catch {
            Toast.show({
              type: 'info',
              text1: `Photo ${i + 1} skipped`,
              text2: 'Continuing without it',
            });
          }
        }
      }

      const payload = buildPayload(uploadedPhotoUrls);

      // ── Sprint 13: Offline path ────────────────────────────────────────────
      if (!isOnline) {
        await offlineQueue.add(payload);
        Toast.show({
          type: 'info',
          text1: '📶 Saved for later',
          text2: 'Your job will post automatically when you reconnect.',
          visibilityTime: 5000,
        });
        router.replace('/(tabs)/search');
        return;
      }

      // ── Online path ────────────────────────────────────────────────────────
      setUploadProgress(isRecurring ? 'Creating recurring schedule…' : 'Posting job…');

      if (isRecurring) {
        // Sprint 12: POST to /recurring
        await api.post('/recurring', {
          category_id: payload.category_id,
          title: payload.title,
          description: payload.description,
          district: payload.district ?? params.district ?? 'Kigali',
          sector: payload.sector,
          location_label: payload.location_label,
          latitude: payload.latitude,
          longitude: payload.longitude,
          budget_per_session: budget ?? 0,
          frequency: recurringFrequency,
          day_of_week: recurringFrequency !== 'monthly' ? recurringDayOfWeek : undefined,
          day_of_month: recurringFrequency === 'monthly' ? recurringDayOfMonth : undefined,
        });

        await qc.invalidateQueries({ queryKey: ['my-recurring-schedules'] });
        Toast.show({
          type: 'success',
          text1: '🔄 Recurring Schedule Created!',
          text2: `Auto-books ${FREQ_LABELS[recurringFrequency].toLowerCase()} — first session scheduled.`,
          visibilityTime: 5000,
        });
      } else {
        await api.post('/jobs', payload);
        await qc.invalidateQueries({ queryKey: ['my-jobs'] });
        Toast.show({
          type: 'success',
          text1: '🎉 Job Posted!',
          text2: 'Artisans will start bidding shortly.',
        });
      }

      router.replace('/(tabs)/search');
    } catch (error: unknown) {
      const netState = await NetInfo.fetch();
      const stillOnline = !!(netState.isConnected && netState.isInternetReachable);

      if (!stillOnline) {
        // Went offline mid-submission — queue it
        const payload = buildPayload([]);
        await offlineQueue.add(payload);
        Toast.show({
          type: 'info',
          text1: '📶 Went offline — job queued',
          text2: 'Will post automatically when you reconnect.',
          visibilityTime: 5000,
        });
        router.replace('/(tabs)/search');
      } else {
        const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
        Toast.show({
          type: 'error',
          text1: 'Failed to post job',
          text2: typeof msg === 'string' ? msg : 'Please try again.',
        });
      }
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  // ── Summary rows ───────────────────────────────────────────────────────────

  const summaryRows = [
    {
      label: 'Service Category',
      value: category?.name_en ?? 'Loading…',
      icon: category?.icon_emoji ?? '🛠️',
    },
    { label: 'Title', value: params.title ?? '' },
    { label: 'Urgency', value: URGENCY_LABELS[params.urgency ?? 'flexible'] },
    {
      label: 'Budget',
      value: budget
        ? `${formatRWF(budget)} RWF${params.budgetNegotiable === '1' ? ' (negotiable)' : ''}`
        : 'Open to bids',
    },
    {
      label: 'Location',
      value:
        params.locationLabel ??
        `${parseFloat(params.latitude ?? '0').toFixed(4)}, ${parseFloat(params.longitude ?? '0').toFixed(4)}`,
    },
    ...(params.scheduledTime
      ? [
          {
            label: 'Scheduled',
            value: new Date(params.scheduledTime).toLocaleString('en-RW', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]
      : []),
    ...(isRecurring
      ? [
          {
            label: '🔄 Recurring',
            icon: '🔄',
            value:
              recurringFrequency === 'monthly'
                ? `${recurringDayOfMonth}${['st', 'nd', 'rd'][recurringDayOfMonth - 1] || 'th'} of every month`
                : recurringFrequency === 'biweekly'
                  ? `Every other ${DAY_NAMES[recurringDayOfWeek]}`
                  : `Every ${DAY_NAMES[recurringDayOfWeek]}`,
          },
        ]
      : []),
    {
      label: 'Photos',
      value:
        photoUris.length > 0
          ? `${photoUris.length} photo${photoUris.length > 1 ? 's' : ''} attached`
          : 'None',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
          {isRecurring ? '🔄 Review Recurring Job' : 'Review & Post'}
        </Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          Step 3 of 3 — Confirm your job details
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 4 }}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#1B5E3B' }}
            />
          ))}
        </View>

        {/* Offline indicator */}
        {!isOnline && (
          <View
            style={{
              marginTop: 8,
              backgroundColor: '#FEF3C7',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 14 }}>📵</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>
              You're offline — job will be queued
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Queued jobs badge */}
        <OfflineBadge count={queuedCount} />

        {/* Recurring banner */}
        {isRecurring && (
          <View
            style={{
              backgroundColor: '#1B5E3B',
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 28 }}>🔄</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                Recurring Schedule
              </Text>
              <Text style={{ fontSize: 12, color: '#BBF7D0', marginTop: 2, lineHeight: 18 }}>
                {FREQ_LABELS[recurringFrequency]} ·{' '}
                {recurringFrequency === 'monthly'
                  ? `${recurringDayOfMonth}${['st', 'nd', 'rd'][recurringDayOfMonth - 1] || 'th'} of month`
                  : DAY_NAMES[recurringDayOfWeek]}
                {recurringPreferSameArtisan
                  ? ' · Same artisan preferred'
                  : ' · Open bidding each time'}
              </Text>
            </View>
          </View>
        )}

        {/* Summary card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          {summaryRows.map(({ label, value, icon }, i) => (
            <View
              key={label}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: i < summaryRows.length - 1 ? 1 : 0,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 2,
                }}
              >
                {icon ? `${icon}  ` : ''}
                {label}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        {params.description ? (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: '#9CA3AF',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Description
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>
              {params.description}
            </Text>
          </View>
        ) : null}

        {/* What happens next */}
        <View
          style={{
            backgroundColor: isRecurring ? '#EFF6FF' : '#F0FDF4',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isRecurring ? '#BFDBFE' : '#BBF7D0',
            padding: 14,
            marginBottom: 32,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: isRecurring ? '#1E40AF' : '#15803D',
              marginBottom: 4,
            }}
          >
            {isRecurring ? '🔄 How recurring jobs work' : '📋 What happens next?'}
          </Text>
          {isRecurring ? (
            <Text style={{ fontSize: 12, color: '#3730A3', lineHeight: 18 }}>
              After confirming, HandyRwanda will auto-schedule your job at each recurrence. If your
              preferred artisan is available, they're auto-booked. Otherwise, bids open to all
              verified artisans.
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: '#4B7C5A', lineHeight: 18 }}>
              Verified artisans matching your category will be notified and submit bids. Compare
              profiles, ratings, and prices — then negotiate and accept.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          paddingTop: 12,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          gap: 10,
        }}
      >
        {uploadProgress ? (
          <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
            {uploadProgress}
          </Text>
        ) : null}

        {!isOnline && (
          <Text style={{ fontSize: 11, color: '#92400E', textAlign: 'center', fontWeight: '600' }}>
            📶 Offline — job will be queued and posted when you reconnect
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Text style={{ fontWeight: '700', color: '#374151' }}>← Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              flex: 2,
              backgroundColor: isOnline ? '#1B5E3B' : '#F59E0B',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                {!isOnline
                  ? '📶 Queue for Later'
                  : isRecurring
                    ? '🔄 Create Recurring Job'
                    : 'Post Job — Free ✓'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Stale job dialog */}
      <StaleJobDialog
        job={staleJob}
        visible={!!staleJob}
        onPost={() => {
          if (staleJob) {
            // Reset to pending so flush picks it up
            offlineQueue.flush(api).then(() => {
              qc.invalidateQueries({ queryKey: ['my-jobs'] });
            });
          }
          setStaleJob(null);
        }}
        onDiscard={() => {
          if (staleJob) offlineQueue.remove(staleJob.id);
          setStaleJob(null);
        }}
      />
    </View>
  );
}
