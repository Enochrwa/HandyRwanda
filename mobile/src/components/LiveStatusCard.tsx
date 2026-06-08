// File: mobile/src/components/LiveStatusCard.tsx
/**
 * Sprint 1 — Live Booking Status Card
 *
 * Renders a rich animated status tracker with:
 *   - Horizontal stepper: Confirmed → Accepted → En Route → Arrived → In Progress → Done
 *   - ETA countdown timer when status is artisan_en_route
 *   - Pulsing green dot animation when status is arrived
 *   - Live WebSocket connection indicator
 *   - Artisan action buttons (accept / en-route / arrived / start)
 *   - Client status display (read-only)
 *
 * Uses react-native-reanimated for smooth animations.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import api from '../services/api';
import { type BookingStatusValue } from '../hooks/useBookingStatus';

// ── Status step configuration ─────────────────────────────────────────────────

interface StatusStep {
  key: BookingStatusValue;
  label: string;
  emoji: string;
  artisanLabel?: string;
}

const STATUS_STEPS: StatusStep[] = [
  { key: 'confirmed',        label: 'Confirmed',   emoji: '✅' },
  { key: 'artisan_accepted', label: 'Accepted',    emoji: '🤝', artisanLabel: 'Accept Job' },
  { key: 'artisan_en_route', label: 'En Route',    emoji: '🚗', artisanLabel: "I'm On My Way" },
  { key: 'arrived',          label: 'Arrived',     emoji: '📍', artisanLabel: "I've Arrived" },
  { key: 'in_progress',      label: 'In Progress', emoji: '🔧', artisanLabel: 'Start Job' },
  { key: 'completed',        label: 'Done',        emoji: '🎉' },
];

const ACTIVE_STATUSES = new Set<BookingStatusValue>([
  'confirmed',
  'artisan_accepted',
  'artisan_en_route',
  'arrived',
  'in_progress',
]);

const STATUS_ORDER: BookingStatusValue[] = STATUS_STEPS.map((s) => s.key);

function getStepIndex(status: BookingStatusValue | null): number {
  if (!status) return -1;
  return STATUS_ORDER.indexOf(status);
}

// ── Countdown timer component ─────────────────────────────────────────────────

function CountdownTimer({ etaMinutes }: { etaMinutes: number }) {
  const [secondsLeft, setSecondsLeft] = useState(etaMinutes * 60);

  useEffect(() => {
    setSecondsLeft(etaMinutes * 60);
  }, [etaMinutes]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 300; // < 5 minutes

  return (
    <Animated.View entering={FadeIn} className="items-center mt-2">
      <Text className="text-muted-foreground text-xs mb-0.5 uppercase tracking-wide">
        Estimated Arrival
      </Text>
      <Text
        className={`text-2xl font-bold tabular-nums ${
          isUrgent ? 'text-accent' : 'text-primary'
        }`}
      >
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </Animated.View>
  );
}

// ── Pulsing arrival dot ───────────────────────────────────────────────────────

function PulsingDot({ style }: { style?: ViewStyle }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 700, easing: Easing.out(Easing.ease) }),
        withTiming(1,   { duration: 700, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 700 }),
        withTiming(1,   { duration: 700 }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#2E7D4F',
        },
        style,
      ]}
    />
  );
}

// ── Artisan action button ─────────────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  emoji: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

function ActionButton({ label, emoji, onPress, loading, variant = 'primary' }: ActionButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      className={`flex-row items-center justify-center py-3.5 px-6 rounded-2xl mt-4 ${
        isPrimary
          ? 'bg-primary active:bg-primary/80'
          : 'bg-accent active:bg-accent/80'
      }`}
      style={{ minHeight: 52 }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Text className="text-lg mr-2">{emoji}</Text>
          <Text className="text-white font-semibold text-base">{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface LiveStatusCardProps {
  bookingId: string;
  status: BookingStatusValue | null;
  etaMinutes?: number | null;
  artisanName?: string;
  isArtisan: boolean;
  /** Called after a successful status transition so parent can refresh */
  onStatusChanged?: (newStatus: BookingStatusValue) => void;
}

export function LiveStatusCard({
  bookingId,
  status,
  etaMinutes,
  artisanName,
  isArtisan,
  onStatusChanged,
}: LiveStatusCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etaInput, setEtaInput] = useState('20');

  const currentIndex = getStepIndex(status);
  const isActive = status ? ACTIVE_STATUSES.has(status) : false;
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled' || status === 'disputed';

  // ── API action handlers ─────────────────────────────────────────────────

  const performTransition = useCallback(
    async (endpoint: string, body?: object) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post(`/bookings/${bookingId}/${endpoint}`, body);
        onStatusChanged?.(res.data.status);
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? 'Action failed. Please try again.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [bookingId, onStatusChanged],
  );

  const handleAccept    = () => performTransition('accept');
  const handleEnRoute   = () => performTransition('en-route', { eta_minutes: parseInt(etaInput, 10) || null });
  const handleArrived   = () => performTransition('arrived');
  const handleStartJob  = () => performTransition('start');

  // ── Render helpers ─────────────────────────────────────────────────────

  if (isCancelled) {
    return (
      <Animated.View entering={FadeInDown.duration(300)} className="bg-card rounded-3xl p-5 border border-border shadow-sm">
        <View className="flex-row items-center">
          <Text className="text-2xl mr-3">❌</Text>
          <View>
            <Text className="font-bold text-foreground text-base">Booking {status === 'disputed' ? 'Disputed' : 'Cancelled'}</Text>
            <Text className="text-muted-foreground text-sm mt-0.5">
              {status === 'disputed' ? 'Under review by our team.' : 'This booking was cancelled.'}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  if (isCompleted) {
    return (
      <Animated.View entering={FadeInDown.duration(300)} className="bg-card rounded-3xl p-5 border border-success/30 shadow-sm">
        <View className="flex-row items-center">
          <Text className="text-3xl mr-3">🎉</Text>
          <View>
            <Text className="font-bold text-success text-base">Job Completed!</Text>
            <Text className="text-muted-foreground text-sm mt-0.5">
              Great work! Don't forget to leave a review.
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify()}
      className="bg-card rounded-3xl p-5 border border-border shadow-sm"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="font-bold text-foreground text-base">Live Status</Text>
        {isActive && (
          <View className="flex-row items-center bg-success/10 px-2.5 py-1 rounded-full">
            <PulsingDot style={{ width: 8, height: 8, borderRadius: 4, marginRight: 5 }} />
            <Text className="text-success text-xs font-semibold">Live</Text>
          </View>
        )}
      </View>

      {/* ── Stepper ────────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between mb-5">
        {STATUS_STEPS.map((step, idx) => {
          const isDone   = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;

          return (
            <React.Fragment key={step.key}>
              {/* Step circle */}
              <View className="items-center" style={{ maxWidth: 44 }}>
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    isDone
                      ? 'bg-success'
                      : isCurrent
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                >
                  {isDone ? (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  ) : (
                    <Text className={`text-sm ${isCurrent ? 'text-white' : 'text-muted-foreground'}`}>
                      {step.emoji}
                    </Text>
                  )}
                </View>
                <Text
                  className={`text-center mt-1 leading-tight ${
                    isCurrent
                      ? 'text-primary font-semibold text-[9px]'
                      : isDone
                      ? 'text-success text-[9px]'
                      : 'text-muted-foreground text-[9px]'
                  }`}
                  numberOfLines={2}
                >
                  {step.label}
                </Text>
              </View>

              {/* Connector line */}
              {idx < STATUS_STEPS.length - 1 && (
                <View
                  className={`flex-1 h-0.5 mx-1 ${
                    isDone ? 'bg-success' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* ── ETA countdown when en route ─────────────────────────────────── */}
      {status === 'artisan_en_route' && etaMinutes != null && etaMinutes > 0 && (
        <Animated.View entering={FadeIn.duration(400)} className="bg-accent/10 rounded-2xl py-3 px-4 mb-2 items-center">
          <CountdownTimer etaMinutes={etaMinutes} />
          <Text className="text-muted-foreground text-xs mt-1">
            {artisanName ? `${artisanName} is on the way` : 'Artisan is on the way'}
          </Text>
        </Animated.View>
      )}

      {/* ── Pulsing arrival indicator ────────────────────────────────────── */}
      {status === 'arrived' && (
        <Animated.View
          entering={FadeIn.duration(400)}
          className="bg-success/10 rounded-2xl py-3 px-4 mb-2 flex-row items-center justify-center"
        >
          <PulsingDot style={{ marginRight: 10 }} />
          <Text className="text-success font-semibold text-sm">
            {artisanName ? `${artisanName} has arrived!` : 'Artisan has arrived!'}
          </Text>
        </Animated.View>
      )}

      {/* ── Error message ────────────────────────────────────────────────── */}
      {error && (
        <Animated.View entering={FadeIn} className="bg-destructive/10 rounded-xl py-2 px-3 mb-2">
          <Text className="text-destructive text-sm text-center">{error}</Text>
        </Animated.View>
      )}

      {/* ── Artisan action buttons ───────────────────────────────────────── */}
      {isArtisan && (
        <View>
          {status === 'confirmed' && (
            <ActionButton
              label="Accept Booking"
              emoji="✅"
              onPress={handleAccept}
              loading={loading}
            />
          )}
          {status === 'artisan_accepted' && (
            <ActionButton
              label="I'm On My Way"
              emoji="🚗"
              onPress={handleEnRoute}
              loading={loading}
            />
          )}
          {status === 'artisan_en_route' && (
            <ActionButton
              label="I've Arrived"
              emoji="📍"
              onPress={handleArrived}
              loading={loading}
            />
          )}
          {status === 'arrived' && (
            <ActionButton
              label="Start Job"
              emoji="🔧"
              onPress={handleStartJob}
              loading={loading}
              variant="secondary"
            />
          )}
        </View>
      )}

      {/* ── Client status message ────────────────────────────────────────── */}
      {!isArtisan && isActive && (
        <Animated.View entering={FadeInDown.delay(200)} className="mt-2">
          <Text className="text-muted-foreground text-xs text-center">
            {status === 'confirmed' && '⏳ Waiting for artisan to accept (15 min window)…'}
            {status === 'artisan_accepted' && '🤝 Artisan has accepted — they\'ll be on the way soon!'}
            {status === 'artisan_en_route' && `🚗 ${artisanName || 'Your artisan'} is heading to you!`}
            {status === 'arrived' && `📍 ${artisanName || 'Your artisan'} is at your door — let them in!`}
            {status === 'in_progress' && '🔧 Work is in progress…'}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default LiveStatusCard;
