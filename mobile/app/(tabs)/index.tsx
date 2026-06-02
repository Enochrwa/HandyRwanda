// File: mobile/app/(tabs)/index.tsx
import { Search, MapPin, Clock, ChevronRight, User, Star } from '@icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const SERVICE_ICONS: Record<string, string> = {
  plumbing: '🔧',
  electrical: '⚡',
  cleaning: '🧹',
  carpentry: '🪚',
  painting: '🎨',
  gardening: '🌿',
  default: '🛠️',
};

export default function HomeScreen() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [checkingOnboard, setCheckingOnboard] = useState(true);

  // Redirect to onboarding on first launch
  useEffect(() => {
    AsyncStorage.getItem('hr_onboarded').then((val) => {
      if (!val) {
        router.replace('/onboarding');
      } else {
        setCheckingOnboard(false);
      }
    });
  }, []);

  const { data: upcomingBookings } = useQuery({
    queryKey: ['upcomingBookings'],
    queryFn: () => api.get('/bookings/upcoming').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),

  if (checkingOnboard) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Mwaramutse' : hour < 18 ? 'Mwiriwe' : 'Muraho';

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      {/* ── Hero Header ─────────────────────────────────────────────── */}
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
          {isAuthenticated ? `${greeting}, ${user?.fullName.split(' ')[0]} 👋` : `${greeting} 👋`}
        </Text>
        <Text className="text-white/80 mt-1 text-sm">
          {isAuthenticated
            ? 'What do you need fixed today?'
            : 'Find trusted artisans across Rwanda'}
        </Text>

        {/* Search bar */}
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

      {/* ── Quick Stats ─────────────────────────────────────────────── */}
      <View className="flex-row mx-6 mt-5 gap-3">
        {[
          { label: 'Artisans', value: '500+', emoji: '👷' },
          { label: 'Districts', value: '30', emoji: '📍' },
          { label: 'Jobs Done', value: '2k+', emoji: '✅' },
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

      {/* ── Service Categories ───────────────────────────────────────── */}
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
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/search',
                    params: { categoryId: cat.id },
                  })
                }
                className="bg-card w-[48%] p-4 rounded-3xl border border-border mb-3 items-center"
              >
                <Text style={{ fontSize: 28 }} className="mb-2">
                  {emoji}
                </Text>
                <Text className="font-semibold text-center text-sm text-foreground">
                  {cat.name_en ?? cat.name}
                </Text>
              </TouchableOpacity>
            );
          }) ||
            [1, 2, 3, 4].map((i) => (
              <View
                key={i}
                className="bg-card w-[48%] h-28 rounded-3xl border border-border mb-3"
              />
            ))}
        </View>
      </View>

      {/* ── How it Works (for unauthenticated) ──────────────────────── */}
      {!isAuthenticated && (
        <View className="mx-6 mb-4 bg-primary/5 border border-primary/20 rounded-3xl p-5">
          <Text className="font-bold text-lg text-foreground mb-3">How HandyRwanda Works</Text>
          {[
            { step: '1', label: 'Search', desc: 'Find a verified artisan near you' },
            { step: '2', label: 'Book', desc: 'Choose a time that works for you' },
            { step: '3', label: 'Pay Safe', desc: 'Funds held until job is done' },
            { step: '4', label: 'Rate', desc: 'Leave a review to help others' },
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
            accessibilityLabel="Sign up to get started"
            onPress={() => router.push('/auth')}
            className="bg-primary mt-2 py-3 rounded-2xl items-center"
          >
            <Text className="text-white font-bold">Sign Up — It's Free</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Upcoming Bookings ────────────────────────────────────────── */}
      <View className="px-6 pb-8">
        <Text className="text-xl font-bold mb-4 text-foreground">Upcoming Bookings</Text>
        {isAuthenticated ? (
          upcomingBookings?.length > 0 ? (
            upcomingBookings.map((booking: any) => (
              <TouchableOpacity
                accessibilityLabel={`Booking: ${booking.title}`}
                key={booking.id}
                onPress={() => router.push(`/messages/${booking.id}`)}
                className="bg-primary/5 p-4 rounded-3xl border border-primary/20 flex-row items-center mb-3"
              >
                <View className="bg-primary/10 p-3 rounded-2xl mr-4">
                  <Clock size={22} color="#1B5E3B" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-foreground">{booking.title}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {booking.scheduled_at ?? 'Soon'} • {booking.artisan_name}
                  </Text>
                </View>
                <ChevronRight size={18} color="#1B5E3B" />
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
  );
}
