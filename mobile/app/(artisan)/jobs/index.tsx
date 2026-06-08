// File: mobile/app/(artisan)/jobs/index.tsx
import { Briefcase, MapPin, ArrowRight, Zap } from '@icons';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import api from '../../../src/services/api';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

interface JobAddress {
  district?: string;
  sector?: string;
  village?: string;
  landmark?: string;
  house_number?: string;
  street_road?: string;
}

interface JobItem {
  id: string;
  title: string;
  description: string;
  distance_km?: number;
  budget?: number;
  created_at: string;
  location_label?: string;
  address?: JobAddress;
  bid_count?: number;
  category?: { name_en: string; icon_emoji?: string };
}

export default function ArtisanJobFeed() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: jobs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['available-jobs'],
    queryFn: () => api.get('/jobs/available').then((r) => r.data),
    refetchInterval: 60000,
  });

  // Sprint 4: instant booking requests (pending_payment from instant flow)
  const { data: instantRequests = [] } = useQuery({
    queryKey: ['instant-booking-requests'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      return (res.data as any[]).filter((b) => b.status === 'pending_payment' && b.is_instant);
    },
    refetchInterval: 15_000,
  });

  const instantCount = instantRequests.length;

  // Sprint 1: count active bookings requiring artisan action
  const { data: activeBookings = [] } = useQuery({
    queryKey: ['artisan-active-bookings'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      const ACTIVE = ['confirmed', 'artisan_accepted', 'artisan_en_route', 'arrived', 'in_progress'];
      return (res.data as any[]).filter((b) => ACTIVE.includes(b.status));
    },
    refetchInterval: 30_000,
  });

  const activeCount = activeBookings.length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: JobItem }) => (
    <TouchableOpacity
      accessibilityLabel={`View job: ${item.title}`}
      onPress={() => router.push(`/(artisan)/jobs/${item.id}`)}
      className="bg-card rounded-3xl border border-border p-5 mb-3 mx-4"
    >
      {/* Category + time */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          {item.category && (
            <View className="bg-primary/10 px-2.5 py-1 rounded-full">
              <Text className="text-primary text-[11px] font-bold">
                {item.category.icon_emoji} {item.category.name_en}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-[11px] text-muted-foreground">
          {item.created_at
            ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
            : ''}
        </Text>
      </View>

      <Text className="text-base font-extrabold text-foreground mb-1">{item.title}</Text>
      <Text className="text-sm text-muted-foreground leading-5 mb-3" numberOfLines={2}>
        {item.description}
      </Text>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          {item.budget && (
            <Text className="text-sm font-bold text-foreground">
              💰 {formatRWF(item.budget)} RWF
            </Text>
          )}
          {(item.address?.district || item.location_label) && (
            <View className="flex-row items-start gap-1">
              <MapPin size={12} color="#6B6B6B" style={{ marginTop: 2 }} />
              <View>
                <Text className="text-[11px] text-muted-foreground">
                  {[item.address?.sector, item.address?.district].filter(Boolean).join(', ') ||
                    item.location_label}
                </Text>
                {item.address?.landmark ? (
                  <Text className="text-[10px] text-amber-600 font-semibold">
                    Near {item.address.landmark}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
          {item.bid_count !== undefined && (
            <Text className="text-[11px] text-muted-foreground">
              {item.bid_count} bid{item.bid_count !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-1 bg-accent rounded-xl px-3 py-1.5">
          <Text className="text-white text-xs font-bold">Bid</Text>
          <ArrowRight size={12} color="white" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="pt-14 pb-4 px-5 bg-primary">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-2xl font-extrabold">Open Jobs</Text>
            <Text className="text-white/80 text-sm mt-0.5">Bid on jobs near you</Text>
          </View>
          <View className="bg-white/20 px-3 py-1.5 rounded-full">
            <Text className="text-white text-sm font-bold">{jobs.length} available</Text>
          </View>
        </View>
      </View>

      {/* Sprint 1: Active jobs banner */}
      {activeCount > 0 && (
        <TouchableOpacity
          onPress={() => router.push('/(artisan)/jobs/active')}
          className="mx-4 mt-4 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3.5 flex-row items-center justify-between"
          style={{ elevation: 2 }}
          activeOpacity={0.85}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 bg-amber-400 rounded-xl items-center justify-center">
              <Zap size={18} color="white" />
            </View>
            <View>
              <Text className="font-extrabold text-amber-800 text-sm">
                {activeCount} Active Job{activeCount > 1 ? 's' : ''} — Action Required
              </Text>
              <Text className="text-amber-600 text-xs mt-0.5">
                Tap to Accept, Go En Route, or Start
              </Text>
            </View>
          </View>
          <ArrowRight size={18} color="#B45309" />
        </TouchableOpacity>
      )}

      {/* Sprint 4: Instant Booking Requests banner */}
      {instantCount > 0 && (
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/(artisan)/jobs/instant-booking-request',
            params: { bookingId: instantRequests[0].id },
          })}
          className="mx-4 mt-3 bg-primary/5 border-2 border-primary rounded-2xl px-4 py-3.5 flex-row items-center justify-between"
          style={{ elevation: 3 }}
          activeOpacity={0.85}
          accessibilityLabel={`${instantCount} instant booking request${instantCount !== 1 ? 's' : ''}`}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 bg-primary rounded-xl items-center justify-center">
              <Zap size={18} color="white" />
            </View>
            <View>
              <View className="flex-row items-center gap-1.5">
                <Text className="font-extrabold text-primary text-sm">
                  ⚡ {instantCount} Instant Booking Request{instantCount !== 1 ? 's' : ''}
                </Text>
                <View className="bg-red-500 rounded-full w-2 h-2" />
              </View>
              <Text className="text-primary/70 text-xs mt-0.5">
                Tap to confirm or decline — expires in 10 minutes
              </Text>
            </View>
          </View>
          <ArrowRight size={18} color="#1B5E3B" />
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1B5E3B" />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center mt-20 px-8">
              <View className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
                <Briefcase size={28} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-bold text-center">No jobs right now</Text>
              <Text className="text-muted-foreground text-center text-sm mt-2">
                New jobs are posted daily. Pull down to refresh.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
