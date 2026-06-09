// File: mobile/app/(artisan)/jobs/instant-booking-request.tsx
/**
 * Sprint 4 — Instant Booking Request Screen (Artisan side)
 *
 * Shown when an artisan taps a push notification for an instant booking
 * request. Displays:
 *   - Client name, avatar, and trust metrics
 *   - Job description and agreed price
 *   - 10-minute countdown timer (request expires)
 *   - Prominent "Confirm ✅" and "Decline ✗" CTAs
 *   - On decline: booking cancelled, job reverts to open bidding
 *   - On confirm: booking moves to confirmed, client notified
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  DollarSign,
  AlertCircle,
  User,
  ChevronLeft,
} from '@icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../src/services/api';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n) + ' RWF';
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Pulse animation for last 2 minutes
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (secondsLeft <= 120 && secondsLeft > 0) {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.06, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        false,
      );
    }
  }, [secondsLeft <= 120]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const expired = secondsLeft <= 0;
  const urgent = secondsLeft <= 120;

  return (
    <Animated.View
      style={[pulseStyle]}
      className={`rounded-2xl p-4 items-center ${
        expired ? 'bg-gray-100' : urgent ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
      }`}
    >
      <View className="flex-row items-center gap-2 mb-1">
        <Clock size={16} color={expired ? '#9CA3AF' : urgent ? '#DC2626' : '#D97706'} />
        <Text
          className={`text-xs font-semibold uppercase tracking-wider ${
            expired ? 'text-muted-foreground' : urgent ? 'text-red-600' : 'text-amber-700'
          }`}
        >
          {expired ? 'Request Expired' : 'Time to Respond'}
        </Text>
      </View>

      {!expired ? (
        <Text
          className={`text-4xl font-extrabold tabular-nums tracking-widest ${
            urgent ? 'text-red-600' : 'text-amber-700'
          }`}
        >
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </Text>
      ) : (
        <Text className="text-lg font-bold text-muted-foreground">00:00</Text>
      )}

      <Text
        className={`text-xs mt-1 ${
          expired ? 'text-muted-foreground' : urgent ? 'text-red-500' : 'text-amber-600'
        }`}
      >
        {expired
          ? 'This booking was automatically cancelled.'
          : urgent
          ? 'Respond now or the request will expire!'
          : 'Client is waiting for your confirmation.'}
      </Text>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function InstantBookingRequestScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: booking,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['instant-booking-request', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then((r) => r.data),
    enabled: !!bookingId,
    refetchInterval: 15_000,
  });

  // ── Confirm mutation ──────────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: () =>
      api.post(`/bookings/${bookingId}/instant-confirm`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artisan-active-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['instant-booking-request', bookingId] });
      Alert.alert(
        '✅ Booking Confirmed!',
        'The client has been notified. Your booking is now confirmed.',
        [
          {
            text: 'View Booking',
            onPress: () => router.replace(`/(artisan)/jobs/${bookingId}`),
          },
        ],
      );
    },
    onError: (err: any) => {
      Alert.alert(
        'Error',
        err?.response?.data?.detail ?? 'Could not confirm booking. Please try again.',
      );
    },
  });

  // ── Decline mutation ──────────────────────────────────────────────────────
  const declineMutation = useMutation({
    mutationFn: () =>
      api.post(`/bookings/${bookingId}/instant-decline`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artisan-active-bookings'] });
      Alert.alert(
        'Booking Declined',
        'The booking has been cancelled and the job has been opened for other artisans.',
        [{ text: 'OK', onPress: () => router.replace('/(artisan)/jobs') }],
      );
    },
    onError: (err: any) => {
      Alert.alert(
        'Error',
        err?.response?.data?.detail ?? 'Could not decline booking. Please try again.',
      );
    },
  });

  const handleConfirm = useCallback(() => {
    Alert.alert(
      '⚡ Confirm Instant Booking?',
      `You'll be confirming a booking for ${formatRWF(booking?.agreed_price ?? 0)}. The client will be notified immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm ✅',
          style: 'default',
          onPress: () => confirmMutation.mutate(),
        },
      ],
    );
  }, [booking, confirmMutation]);

  const handleDecline = useCallback(() => {
    Alert.alert(
      'Decline Booking?',
      "The client's job will be opened for other artisans to bid on. Are you sure?",
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => declineMutation.mutate(),
        },
      ],
    );
  }, [declineMutation]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1B5E3B" size="large" />
        <Text className="mt-3 text-sm text-muted-foreground">Loading booking details…</Text>
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <AlertCircle size={48} color="#9CA3AF" />
        <Text className="mt-3 text-lg font-bold text-foreground text-center">
          Booking not found
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground text-center">
          This booking may have already been cancelled or expired.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary px-6 py-3 rounded-2xl"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isExpired = booking.status !== 'pending_payment';
  const alreadyActed = ['confirmed', 'cancelled', 'artisan_accepted'].includes(booking.status);
  const isBusy = confirmMutation.isPending || declineMutation.isPending;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-14 pb-5 px-5 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/20 items-center justify-center"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={20} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xl font-extrabold">⚡ Instant Booking Request</Text>
          <Text className="text-white/75 text-sm mt-0.5">
            {isExpired ? 'No action required' : 'Client is waiting — respond quickly'}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Countdown ────────────────────────────────────────────────── */}
        {!alreadyActed && booking.auto_confirm_at && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <Countdown expiresAt={
              // expires_at from instant booking is 10 minutes, not auto_confirm_at
              // We approximate: booking created_at + 10 minutes
              new Date(new Date(booking.created_at).getTime() + 10 * 60 * 1000).toISOString()
            } />
          </Animated.View>
        )}

        {/* ── Already acted ─────────────────────────────────────────────── */}
        {alreadyActed && (
          <Animated.View
            entering={FadeIn}
            className={`rounded-2xl p-4 items-center mb-4 ${
              booking.status === 'confirmed' ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-100'
            }`}
          >
            {booking.status === 'confirmed' ? (
              <>
                <CheckCircle2 size={32} color="#059669" />
                <Text className="text-emerald-700 font-extrabold text-lg mt-2">
                  Booking Confirmed
                </Text>
                <Text className="text-emerald-600 text-sm mt-1">
                  The client has been notified.
                </Text>
              </>
            ) : (
              <>
                <XCircle size={32} color="#9CA3AF" />
                <Text className="text-muted-foreground font-bold text-lg mt-2">
                  Booking Declined / Expired
                </Text>
              </>
            )}
          </Animated.View>
        )}

        {/* ── Client info ───────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          className="mt-4 bg-card border border-border rounded-3xl p-4 shadow-sm"
        >
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Client
          </Text>
          <View className="flex-row items-center gap-3">
            <View className="w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center">
              <User size={28} color="#1B5E3B" />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-foreground text-base">
                {booking.client_name ?? 'Client'}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {booking.client_district ?? 'Rwanda'} · Previously worked together
              </Text>
              {booking.client_total_bookings !== undefined && (
                <Text className="text-xs text-primary font-semibold mt-0.5">
                  {booking.client_total_bookings} bookings on HandyRwanda
                </Text>
              )}
            </View>
          </View>
        </Animated.View>

        {/* ── Job Details ───────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(120).springify()}
          className="mt-4 bg-card border border-border rounded-3xl p-4 shadow-sm"
        >
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Job Details
          </Text>

          <Text className="font-extrabold text-foreground text-lg mb-2">
            {booking.title ?? 'Instant Booking'}
          </Text>

          <Text className="text-sm text-foreground leading-relaxed mb-4">
            {booking.description ?? 'No description provided.'}
          </Text>

          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <DollarSign size={16} color="#1B5E3B" />
              <Text className="text-sm font-semibold text-foreground">
                Agreed Price:{' '}
                <Text className="text-primary font-extrabold">
                  {formatRWF(booking.agreed_price ?? 0)}
                </Text>
              </Text>
            </View>

            {(booking.address_district || booking.location_label) && (
              <View className="flex-row items-center gap-2">
                <MapPin size={16} color="#1B5E3B" />
                <Text className="text-sm text-muted-foreground">
                  {booking.address_district ?? booking.location_label}
                </Text>
              </View>
            )}

            {booking.scheduled_time && (
              <View className="flex-row items-center gap-2">
                <Clock size={16} color="#1B5E3B" />
                <Text className="text-sm text-muted-foreground">
                  {new Date(booking.scheduled_time).toLocaleString('en-RW', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── What Instant Booking means ────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(160).springify()}
          className="mt-4 bg-primary/5 border border-primary/15 rounded-2xl p-4"
        >
          <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
            ⚡ Instant Booking
          </Text>
          <Text className="text-sm text-foreground leading-relaxed">
            This client has worked with you before and chose to skip the bidding process.
            Confirming this booking means you commit to the agreed price of{' '}
            <Text className="font-bold text-primary">{formatRWF(booking.agreed_price ?? 0)}</Text>.
          </Text>
          <Text className="text-xs text-muted-foreground mt-2">
            Declining will open the job for other artisans to bid on.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* ── Sticky CTA Footer ─────────────────────────────────────────── */}
      {!alreadyActed && (
        <View
          className="absolute bottom-0 inset-x-0 bg-card border-t border-border px-5 py-4 gap-3"
          style={{ paddingBottom: 32 }}
        >
          {/* Confirm */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isBusy}
            className={`flex-row items-center justify-center gap-2 py-4 rounded-2xl ${
              isBusy ? 'bg-muted' : 'bg-primary'
            }`}
            style={{ elevation: isBusy ? 0 : 3 }}
            accessibilityLabel="Confirm instant booking"
            accessibilityRole="button"
          >
            {confirmMutation.isPending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <CheckCircle2 size={20} color="white" />
                <Text className="text-white font-extrabold text-base">
                  Confirm Booking — {formatRWF(booking.agreed_price ?? 0)}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Decline */}
          <TouchableOpacity
            onPress={handleDecline}
            disabled={isBusy}
            className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 bg-red-50"
            accessibilityLabel="Decline instant booking"
            accessibilityRole="button"
          >
            {declineMutation.isPending ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <XCircle size={18} color="#DC2626" />
                <Text className="text-red-600 font-bold text-sm">
                  Decline — Open for Bidding
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Post-action back button */}
      {alreadyActed && (
        <View className="absolute bottom-0 inset-x-0 bg-card border-t border-border px-5 py-4" style={{ paddingBottom: 32 }}>
          <TouchableOpacity
            onPress={() => router.replace('/(artisan)/jobs')}
            className="bg-primary py-4 rounded-2xl items-center"
          >
            <Text className="text-white font-extrabold text-base">Back to Jobs</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
