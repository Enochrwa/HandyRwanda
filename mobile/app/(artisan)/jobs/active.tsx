// File: mobile/app/(artisan)/jobs/active.tsx
/**
 * Sprint 1 — Artisan Active Bookings Screen
 *
 * Shows bookings that require artisan action:
 *   confirmed       → Accept (15-min window with countdown)
 *   artisan_accepted → I'm On My Way
 *   artisan_en_route → I've Arrived
 *   arrived          → Start Job
 *   in_progress      → (client marks complete)
 *
 * Linked from the artisan jobs tab as a "My Active Jobs" section.
 */

import { MapPin, Clock, ChevronRight, AlertCircle } from '@icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';
import { useNotificationSocket } from '../../../src/hooks/useNotificationSocket';
import { LiveStatusCard } from '../../../src/components/LiveStatusCard';
import type { BookingStatusValue } from '../../../src/hooks/useBookingStatus';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

// ── Accept countdown timer ────────────────────────────────────────────────────
// Shows how many minutes remain in the 15-min accept window

function AcceptCountdown({ acceptedAt }: { acceptedAt?: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState(900); // 15 * 60

  useEffect(() => {
    if (!acceptedAt) return;
    // acceptedAt is when the booking was CONFIRMED (payment sent), not when artisan accepted
    // The 15-min window starts from confirmed_at, which we approximate as now - (15*60 - initial)
    const updateLeft = () => {
      const confirmTime = new Date(acceptedAt).getTime();
      const elapsed = (Date.now() - confirmTime) / 1000;
      const left = Math.max(0, 900 - elapsed);
      setSecondsLeft(Math.floor(left));
    };
    updateLeft();
    const id = setInterval(updateLeft, 1000);
    return () => clearInterval(id);
  }, [acceptedAt]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 180; // < 3 min

  if (secondsLeft <= 0) {
    return (
      <View className="flex-row items-center gap-1 mt-1">
        <AlertCircle size={11} color="#EF4444" />
        <Text className="text-destructive text-xs font-semibold">Window expired</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1 mt-1">
      <Clock size={11} color={isUrgent ? '#EF4444' : '#F59E0B'} />
      <Text
        className="text-xs font-semibold tabular-nums"
        style={{ color: isUrgent ? '#EF4444' : '#F59E0B' }}
      >
        Accept within {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
}

// ── Pulsing live dot ──────────────────────────────────────────────────────────

function PulsingDot({ color = '#1B5E3B' }: { color?: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[style, { width: 8, height: 8, borderRadius: 4, backgroundColor: color }]}
    />
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; emoji: string; color: string; urgent?: boolean }> = {
  confirmed:        { label: '⚡ Accept Now',    emoji: '✅', color: '#F59E0B', urgent: true },
  artisan_accepted: { label: "📍 I'm On My Way", emoji: '🤝', color: '#8B5CF6' },
  artisan_en_route: { label: "🚗 En Route",       emoji: '🚗', color: '#F97316' },
  arrived:          { label: '🔧 Start Job',      emoji: '📍', color: '#10B981' },
  in_progress:      { label: '⏳ In Progress',    emoji: '🔧', color: '#059669' },
};

const ACTIVE_STATUSES = Object.keys(STATUS_CFG);

// ── Booking card ──────────────────────────────────────────────────────────────

interface ActiveBooking {
  id: string;
  title: string;
  location_label?: string;
  status: BookingStatusValue;
  agreed_price: number;
  other_name?: string;
  eta_minutes?: number;
  created_at?: string;
}

function ActiveBookingCard({
  booking,
  onStatusChanged,
}: {
  booking: ActiveBooking;
  onStatusChanged: (id: string, status: BookingStatusValue) => void;
}) {
  const [expanded, setExpanded] = useState(booking.status === 'confirmed');
  const cfg = STATUS_CFG[booking.status];

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      className={`bg-card rounded-3xl border mb-4 overflow-hidden ${
        cfg?.urgent ? 'border-amber-300' : 'border-border'
      }`}
      style={{ elevation: cfg?.urgent ? 4 : 2 }}
    >
      {/* Card header */}
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        className="p-4"
        activeOpacity={0.8}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            {/* Title + live dot */}
            <View className="flex-row items-center gap-2 mb-1">
              {cfg && ['artisan_en_route', 'arrived', 'in_progress'].includes(booking.status) && (
                <PulsingDot color={cfg.color} />
              )}
              <Text className="font-bold text-foreground text-base flex-1" numberOfLines={1}>
                {booking.title}
              </Text>
            </View>

            {/* Client name + location */}
            <Text className="text-muted-foreground text-xs">
              👤 {booking.other_name ?? 'Client'}
            </Text>
            {booking.location_label && (
              <View className="flex-row items-center gap-1 mt-0.5">
                <MapPin size={10} color="#6B6B6B" />
                <Text className="text-muted-foreground text-xs flex-1" numberOfLines={1}>
                  {booking.location_label}
                </Text>
              </View>
            )}

            {/* Accept countdown for confirmed bookings */}
            {booking.status === 'confirmed' && (
              <AcceptCountdown acceptedAt={booking.created_at} />
            )}

            {/* ETA for en-route */}
            {booking.status === 'artisan_en_route' && booking.eta_minutes && (
              <Text className="text-orange-500 text-xs font-semibold mt-0.5">
                🚗 ETA: ~{booking.eta_minutes} min
              </Text>
            )}
          </View>

          {/* Price + expand toggle */}
          <View className="items-end gap-1">
            <Text className="font-extrabold text-primary text-sm">
              {formatRWF(booking.agreed_price)} RWF
            </Text>
            {cfg && (
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${cfg.color}20` }}
              >
                <Text className="text-xs font-semibold" style={{ color: cfg.color }}>
                  {cfg.emoji} {cfg.label}
                </Text>
              </View>
            )}
            <Text className="text-muted-foreground text-[10px]">
              {expanded ? '▲ less' : '▼ more'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded: show live status card with action buttons */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-border pt-3">
          <LiveStatusCard
            bookingId={booking.id}
            status={booking.status}
            etaMinutes={booking.eta_minutes}
            isArtisan={true}
            onStatusChanged={(newStatus) => onStatusChanged(booking.id, newStatus)}
          />
        </View>
      )}
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ArtisanActiveBookings() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Plug in the notification socket so WS status changes invalidate the list
  useNotificationSocket();

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ['artisan-active-bookings'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      // Filter to only active/actionable bookings
      return (res.data as ActiveBooking[]).filter((b) =>
        ACTIVE_STATUSES.includes(b.status),
      );
    },
    refetchInterval: 30_000, // poll every 30s as fallback
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleStatusChanged = useCallback(
    (bookingId: string, newStatus: BookingStatusValue) => {
      qc.invalidateQueries({ queryKey: ['artisan-active-bookings'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      Toast.show({
        type: 'success',
        text1: '✅ Updated',
        text2: `Status: ${newStatus.replace(/_/g, ' ')}`,
      });
    },
    [qc],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-14 pb-6 px-6 rounded-b-[32px]">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-xl font-extrabold">Active Jobs</Text>
            <Text className="text-white/70 text-xs mt-0.5">
              {bookings.length} job{bookings.length !== 1 ? 's' : ''} requiring action
            </Text>
          </View>
          {bookings.length > 0 && (
            <View className="w-8 h-8 bg-accent rounded-full items-center justify-center">
              <Text className="text-white font-bold text-sm">{bookings.length}</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1B5E3B"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-24">
            <Text className="text-5xl mb-4">🎉</Text>
            <Text className="text-foreground font-bold text-lg text-center">All caught up!</Text>
            <Text className="text-muted-foreground text-sm text-center mt-2 px-8">
              No active bookings right now. New jobs will appear here when clients book you.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(artisan)/jobs')}
              className="mt-5 bg-primary px-6 py-3 rounded-2xl"
            >
              <Text className="text-white font-bold">Browse Available Jobs</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <ActiveBookingCard
            booking={item}
            onStatusChanged={handleStatusChanged}
          />
        )}
      />
    </View>
  );
}
