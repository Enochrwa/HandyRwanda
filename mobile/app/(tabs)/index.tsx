// File: mobile/app/(tabs)/index.tsx
/**
 * Sprint 1 + Sprint 4 enhanced Home Screen
 *
 * Sprint 1 additions:
 *  - Upcoming bookings with animated live status badges
 *  - Active booking urgent banner (en route / arrived / in progress)
 *  - ETA shown inline when artisan is en route
 *
 * Sprint 4 additions:
 *  - "Book Again 🔄" horizontal scroll row (client-only)
 *  - InstantBookSheet bottom sheet for one-tap re-booking
 *  - Real-time `instant_book_eligible` indicator on each artisan avatar
 */

import { Search, MapPin, Clock, ChevronRight, User, Star, Plus, Zap } from '@icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { InstantBookSheet } from '../../src/components/InstantBookSheet';
import type { PreviousArtisan } from '../../src/components/InstantBookSheet';
import { usePreviousArtisans } from '../../src/hooks/usePreviousArtisans';
import { SafetyScoreBadge } from '../../src/components/SafetyScoreBadge';

const SERVICE_ICONS: Record<string, string> = {
  plumbing:    '🔧',
  electrical:  '⚡',
  cleaning:    '🧹',
  carpentry:   '🪚',
  painting:    '🎨',
  gardening:   '🌿',
  default:     '🛠️',
};

// ── Sprint 1: status display config ──────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; emoji: string; color: string; bgColor: string; pulsing?: boolean }
> = {
  pending_payment:  { label: 'Payment Due',    emoji: '💰', color: '#F59E0B', bgColor: '#FEF3C7' },
  confirmed:        { label: 'Confirmed',       emoji: '✅', color: '#3B82F6', bgColor: '#EFF6FF' },
  artisan_accepted: { label: 'Artisan Ready',   emoji: '🤝', color: '#8B5CF6', bgColor: '#F5F3FF' },
  artisan_en_route: { label: 'En Route',        emoji: '🚗', color: '#F97316', bgColor: '#FFF7ED', pulsing: true },
  arrived:          { label: 'Arrived!',        emoji: '📍', color: '#10B981', bgColor: '#ECFDF5', pulsing: true },
  in_progress:      { label: 'In Progress',     emoji: '🔧', color: '#059669', bgColor: '#ECFDF5', pulsing: true },
  completed:        { label: 'Completed',       emoji: '🎉', color: '#1B5E3B', bgColor: '#F0FDF4' },
  cancelled:        { label: 'Cancelled',       emoji: '❌', color: '#6B6B6B', bgColor: '#F3F4F6' },
  disputed:         { label: 'Disputed',        emoji: '⚠️', color: '#EF4444', bgColor: '#FEF2F2' },
};

// ── Pulsing status dot ────────────────────────────────────────────────────────

function PulsingStatusDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[animStyle, { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }]}
    />
  );
}

// ── Booking status badge ──────────────────────────────────────────────────────

function BookingStatusBadge({ status, etaMinutes }: { status: string; etaMinutes?: number }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    emoji: '🔄',
    color: '#6B6B6B',
    bgColor: '#F3F4F6',
  };

  return (
    <View
      className="flex-row items-center px-2.5 py-1 rounded-full gap-1.5"
      style={{ backgroundColor: cfg.bgColor }}
    >
      {cfg.pulsing && <PulsingStatusDot color={cfg.color} />}
      <Text className="text-xs font-semibold" style={{ color: cfg.color }}>
        {cfg.emoji} {cfg.label}
        {status === 'artisan_en_route' && etaMinutes ? ` · ${etaMinutes}m` : ''}
      </Text>
    </View>
  );
}

// ── Sprint 4: Book Again — artisan avatar card ─────────────────────────────────

function BookAgainCard({
  artisan,
  onPress,
}: {
  artisan: PreviousArtisan;
  onPress: () => void;
}) {
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (artisan.instant_book_eligible) {
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 900 }), withTiming(1, { duration: 900 })),
        -1,
        false,
      );
    }
  }, [artisan.instant_book_eligible]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: artisan.instant_book_eligible ? pulseOpacity.value : 1,
  }));

  // Emoji for last category
  const categoryKey = artisan.last_category?.toLowerCase() ?? 'default';
  const emoji = SERVICE_ICONS[categoryKey] ?? SERVICE_ICONS.default;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel={`Book ${artisan.full_name} again`}
      className="items-center mr-4"
      style={{ width: 76 }}
    >
      {/* Avatar with online/eligible indicator */}
      <View className="relative mb-2">
        {artisan.avatar_url ? (
          <Image
            source={{ uri: artisan.avatar_url }}
            className="w-[60px] h-[60px] rounded-2xl"
            style={{
              borderWidth: artisan.instant_book_eligible ? 2.5 : 1.5,
              borderColor: artisan.instant_book_eligible ? '#1B5E3B' : '#E5E7EB',
            }}
          />
        ) : (
          <View
            className="w-[60px] h-[60px] rounded-2xl bg-primary/15 items-center justify-center"
            style={{
              borderWidth: artisan.instant_book_eligible ? 2.5 : 1.5,
              borderColor: artisan.instant_book_eligible ? '#1B5E3B' : '#E5E7EB',
            }}
          >
            <Text className="text-primary font-extrabold text-xl">
              {artisan.full_name[0].toUpperCase()}
            </Text>
          </View>
        )}

        {/* Category emoji badge */}
        <View className="absolute -bottom-1.5 -left-1.5 bg-card rounded-lg px-1 py-0.5 border border-border">
          <Text style={{ fontSize: 11 }}>{emoji}</Text>
        </View>

        {/* Eligibility indicator */}
        {artisan.instant_book_eligible ? (
          <Animated.View
            style={[pulseStyle]}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary items-center justify-center border-2 border-card"
          >
            <Zap size={10} color="white" />
          </Animated.View>
        ) : (
          <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-card" />
        )}
      </View>

      {/* Name */}
      <Text
        className="text-[11px] font-semibold text-foreground text-center leading-tight"
        numberOfLines={2}
      >
        {artisan.full_name.split(' ')[0]}
      </Text>

      {/* Rating */}
      <View className="flex-row items-center mt-0.5">
        <Star size={9} color="#F59E0B" fill="#F59E0B" />
        <Text className="text-[10px] text-muted-foreground ml-0.5">
          {artisan.average_rating.toFixed(1)}
        </Text>
      </View>

      {/* Sprint 5: Safety Score dot */}
      {artisan.community_score != null && artisan.community_score > 0 && (
        <View className="mt-1">
          <SafetyScoreBadge score={artisan.community_score} variant="dot" showInfo={false} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Sprint 4: Book Again section ──────────────────────────────────────────────

function BookAgainSection({
  onSelectArtisan,
  isClient,
}: {
  onSelectArtisan: (artisan: PreviousArtisan) => void;
  isClient: boolean;
}) {
  const { data, isLoading, isError } = usePreviousArtisans(isClient);

  // Only render if client has prior artisans
  if (!isClient || isLoading || isError || !data || data.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(60).springify()} className="mt-5">
      <View className="px-6 flex-row justify-between items-center mb-3">
        <View>
          <Text className="text-lg font-extrabold text-foreground">
            Book Again 🔄
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Tap ⚡ to instantly re-book • no bidding required
          </Text>
        </View>
      </View>

      <FlatList
        data={data.slice(0, 5)}
        keyExtractor={(item) => item.artisan_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24 }}
        renderItem={({ item }: { item: PreviousArtisan }) => (
          <BookAgainCard artisan={item} onPress={() => onSelectArtisan(item)} />
        )}
      />
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [checkingOnboard, setCheckingOnboard] = useState(true);
  const isArtisan = user?.role === 'artisan';
  const isClient = isAuthenticated && !isArtisan;

  // Sprint 4: selected artisan for instant book sheet
  const [instantBookArtisan, setInstantBookArtisan] = useState<PreviousArtisan | null>(null);
  const [instantBookOpen, setInstantBookOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('hr_onboarded').then((val: string | null) => {
      if (!val) {
        router.replace('/onboarding');
      } else {
        setCheckingOnboard(false);
      }
    });
  }, []);

  const { data: upcomingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ['upcomingBookings'],
    queryFn: () => api.get('/bookings/upcoming').then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 30_000 : false,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  if (checkingOnboard) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Mwaramutse' : hour < 18 ? 'Mwiriwe' : 'Muraho';

  const activeBooking = upcomingBookings?.find((b: any) =>
    ['artisan_en_route', 'arrived', 'in_progress', 'artisan_accepted'].includes(b.status),
  );

  const handleSelectArtisan = (artisan: PreviousArtisan) => {
    setInstantBookArtisan(artisan);
    setInstantBookOpen(true);
  };

  const handleInstantBookSuccess = (bookingId: string) => {
    setInstantBookOpen(false);
    // Small delay so sheet animates out before navigating
    setTimeout(() => {
      router.push(`/messages/${bookingId}`);
    }, 400);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ───────────────────────────────────────────────── */}
        <View className="bg-primary pt-14 pb-10 px-6 rounded-b-[40px]">
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-white/70 text-xs uppercase tracking-wider">Location</Text>
              <View className="flex-row items-center mt-0.5">
                <MapPin size={13} color="white" />
                <Text className="text-white font-semibold ml-1 text-sm">Rwanda</Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityLabel="Profile or login"
              onPress={() =>
                isAuthenticated ? router.push('/(tabs)/profile') : router.push('/auth')
              }
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center overflow-hidden"
            >
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} className="w-full h-full" />
              ) : (
                <User color="white" size={22} />
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-white text-2xl font-extrabold">
            {isAuthenticated ? `${greeting}, ${user?.fullName?.split(' ')[0]} 👋` : `${greeting} 👋`}
          </Text>
          <Text className="text-white/80 mt-1 text-sm">
            {isAuthenticated ? 'What do you need fixed today?' : 'Find trusted artisans across Rwanda'}
          </Text>

          <TouchableOpacity
            accessibilityLabel="Search artisans"
            onPress={() => router.push('/(tabs)/search')}
            className="mt-5 flex-row items-center bg-white px-4 py-3.5 rounded-2xl"
          >
            <Search size={18} color="#6B6B6B" />
            <Text className="text-muted-foreground ml-3 text-sm">
              Plumbers, electricians, cleaners…
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Sprint 1: Live booking urgent banner ───────────────────────── */}
        {activeBooking && (
          <TouchableOpacity
            accessibilityLabel="View active booking"
            onPress={() => router.push(`/messages/${activeBooking.id}`)}
            className="mx-6 mt-4 rounded-2xl overflow-hidden"
            style={{
              backgroundColor:
                STATUS_CONFIG[activeBooking.status]?.bgColor ?? '#F0FDF4',
              borderWidth: 1.5,
              borderColor: STATUS_CONFIG[activeBooking.status]?.color ?? '#1B5E3B',
            }}
          >
            <View className="px-4 py-3.5 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-2xl mr-3">
                  {STATUS_CONFIG[activeBooking.status]?.emoji ?? '🔄'}
                </Text>
                <View className="flex-1">
                  <Text
                    className="font-bold text-sm"
                    style={{ color: STATUS_CONFIG[activeBooking.status]?.color ?? '#1B5E3B' }}
                    numberOfLines={1}
                  >
                    {activeBooking.title}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: '#6B6B6B' }}>
                    {activeBooking.status === 'artisan_en_route' && activeBooking.eta_minutes
                      ? `${activeBooking.artisan_name} arriving in ~${activeBooking.eta_minutes} min`
                      : activeBooking.status === 'arrived'
                      ? `${activeBooking.artisan_name} is at your door!`
                      : activeBooking.status === 'in_progress'
                      ? `Work in progress with ${activeBooking.artisan_name}`
                      : `${activeBooking.artisan_name} accepted your booking`}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <PulsingStatusDot color={STATUS_CONFIG[activeBooking.status]?.color ?? '#1B5E3B'} />
                <ChevronRight
                  size={18}
                  color={STATUS_CONFIG[activeBooking.status]?.color ?? '#1B5E3B'}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Sprint 4: Book Again row ──────────────────────────────────── */}
        <BookAgainSection
          isClient={isClient}
          onSelectArtisan={handleSelectArtisan}
        />

        {/* ── Post a Job CTA ────────────────────────────────────────────── */}
        {isClient && (
          <View className="mx-6 mt-5">
            <TouchableOpacity
              accessibilityLabel="Post a job"
              onPress={() => router.push('/(client)/post-job')}
              className="bg-primary rounded-3xl px-5 py-4 flex-row items-center justify-between shadow-sm"
              style={{ elevation: 3 }}
            >
              <View className="flex-row items-center flex-1">
                <View className="w-11 h-11 bg-white/20 rounded-2xl items-center justify-center mr-4">
                  <Plus size={24} color="white" />
                </View>
                <View>
                  <Text className="text-white font-extrabold text-base">Post a Job</Text>
                  <Text className="text-white/75 text-xs mt-0.5">Get bids from verified artisans</Text>
                </View>
              </View>
              <ChevronRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {!isAuthenticated && (
          <View className="mx-6 mt-5">
            <TouchableOpacity
              accessibilityLabel="Post a job — sign in first"
              onPress={() => router.push('/auth')}
              className="bg-primary rounded-3xl px-5 py-4 flex-row items-center justify-between"
              style={{ elevation: 3 }}
            >
              <View className="flex-row items-center flex-1">
                <View className="w-11 h-11 bg-white/20 rounded-2xl items-center justify-center mr-4">
                  <Plus size={24} color="white" />
                </View>
                <View>
                  <Text className="text-white font-extrabold text-base">Post a Job</Text>
                  <Text className="text-white/75 text-xs mt-0.5">Sign in to get started</Text>
                </View>
              </View>
              <ChevronRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick Stats ─────────────────────────────────────────────── */}
        <View className="flex-row mx-6 mt-5 gap-3">
          {[
            { label: 'Artisans', value: '500+', emoji: '👷' },
            { label: 'Districts', value: '30',   emoji: '📍' },
            { label: 'Jobs Done', value: '2k+',  emoji: '✅' },
          ].map((stat) => (
            <View
              key={stat.label}
              className="flex-1 bg-card border border-border rounded-2xl p-3 items-center"
            >
              <Text style={{ fontSize: 20 }}>{stat.emoji}</Text>
              <Text className="font-extrabold text-primary text-base">{stat.value}</Text>
              <Text className="text-xs text-muted-foreground">{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Service Categories ──────────────────────────────────────── */}
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-foreground">Services</Text>
            <TouchableOpacity
              accessibilityLabel="See all services"
              onPress={() => router.push('/(tabs)/search')}
            >
              <Text className="text-primary font-semibold text-sm">See All →</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap justify-between">
            {categories?.slice(0, 6).map((cat: any) => {
              const emoji =
                SERVICE_ICONS[cat.slug?.toLowerCase()] ||
                SERVICE_ICONS[cat.name_en?.toLowerCase()] ||
                SERVICE_ICONS.default;
              return (
                <TouchableOpacity
                  accessibilityLabel={`Browse ${cat.name_en ?? cat.name}`}
                  key={cat.id}
                  onPress={() => {
                    if (isClient) {
                      router.push({
                        pathname: '/(client)/post-job/details',
                        params: { categoryId: cat.id },
                      });
                    } else {
                      router.push({ pathname: '/(tabs)/search', params: { categoryId: cat.id } });
                    }
                  }}
                  className="bg-card w-[48%] p-4 rounded-3xl border border-border mb-3 items-center"
                >
                  <Text style={{ fontSize: 28 }} className="mb-2">{emoji}</Text>
                  <Text className="font-semibold text-center text-sm text-foreground">
                    {cat.name_en ?? cat.name}
                  </Text>
                  {isClient && (
                    <Text className="text-[10px] text-primary mt-1 font-semibold">Post Job →</Text>
                  )}
                </TouchableOpacity>
              );
            }) ||
              [1, 2, 3, 4].map((i) => (
                <View key={i} className="bg-card w-[48%] h-28 rounded-3xl border border-border mb-3" />
              ))}
          </View>
        </View>

        {/* ── How it Works (unauthenticated) ──────────────────────────── */}
        {!isAuthenticated && (
          <View className="mx-6 mb-4 bg-primary/5 border border-primary/20 rounded-3xl p-5">
            <Text className="font-bold text-lg text-foreground mb-3">How HandyRwanda Works</Text>
            {[
              { step: '1', label: 'Search',   desc: 'Find a verified artisan near you' },
              { step: '2', label: 'Book',     desc: 'Choose a time that works for you' },
              { step: '3', label: 'Pay Safe', desc: 'Funds held until job is done' },
              { step: '4', label: 'Rate',     desc: 'Leave a review to help others' },
            ].map((item) => (
              <View key={item.step} className="flex-row items-start mb-3">
                <View className="w-7 h-7 bg-primary rounded-full items-center justify-center mr-3 mt-0.5">
                  <Text className="text-white text-xs font-bold">{item.step}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-foreground">{item.label}</Text>
                  <Text className="text-muted-foreground text-xs">{item.desc}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              accessibilityLabel="Sign up"
              onPress={() => router.push('/auth')}
              className="bg-primary mt-2 py-3 rounded-2xl items-center"
            >
              <Text className="text-white font-bold">Sign Up — It's Free</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Upcoming Bookings (Sprint 1: with live status badges) ──── */}
        <View className="px-6 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-foreground">Upcoming Bookings</Text>
            {upcomingBookings?.length > 0 && (
              <TouchableOpacity onPress={() => refetchBookings()}>
                <Text className="text-primary text-xs font-semibold">Refresh</Text>
              </TouchableOpacity>
            )}
          </View>

          {isAuthenticated ? (
            upcomingBookings?.length > 0 ? (
              upcomingBookings.map((booking: any) => (
                <TouchableOpacity
                  accessibilityLabel={`Booking: ${booking.title}`}
                  key={booking.id}
                  onPress={() => router.push(`/messages/${booking.id}`)}
                  className="bg-card p-4 rounded-3xl border border-border mb-3 shadow-sm"
                  style={{ elevation: 1 }}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <View className="bg-primary/10 p-2.5 rounded-2xl mr-3">
                        <Clock size={18} color="#1B5E3B" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-bold text-foreground text-sm" numberOfLines={1}>
                          {booking.title}
                        </Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          {booking.artisan_name}
                          {booking.eta_minutes && booking.status === 'artisan_en_route'
                            ? ` · ~${booking.eta_minutes} min away`
                            : ''}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </View>

                  {/* Sprint 1: Live status badge */}
                  <BookingStatusBadge
                    status={booking.status}
                    etaMinutes={booking.eta_minutes}
                  />
                </TouchableOpacity>
              ))
            ) : (
              <View className="bg-card p-6 rounded-3xl border border-dashed border-border items-center">
                <Text className="text-2xl mb-2">📅</Text>
                <Text className="text-muted-foreground text-center text-sm">
                  No upcoming bookings. Browse services to get started!
                </Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              accessibilityLabel="Log in to see bookings"
              onPress={() => router.push('/auth')}
              className="bg-card p-6 rounded-3xl border border-dashed border-border items-center"
            >
              <Star size={28} color="#1B5E3B" />
              <Text className="text-muted-foreground text-center text-sm mt-2">
                Log in to track your bookings and connect with artisans.
              </Text>
              <Text className="text-primary font-bold mt-2">Log in / Register →</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Sprint 4: Instant Book Bottom Sheet ───────────────────────── */}
      <InstantBookSheet
        artisan={instantBookArtisan}
        visible={instantBookOpen}
        onClose={() => setInstantBookOpen(false)}
        onSuccess={handleInstantBookSuccess}
      />
    </View>
  );
}
