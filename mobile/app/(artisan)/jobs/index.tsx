// File: mobile/app/(artisan)/jobs/index.tsx
import { Briefcase, MapPin, ArrowRight, Filter } from '@icons';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';

import api from '../../../src/services/api';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

const URGENCY_LABELS: Record<string, string> = {
  flexible: '📅 Flexible',
  this_week: '🗓️ This Week',
  tomorrow: '⏰ Tomorrow',
  today: '🔥 Today',
  urgent: '🚨 Urgent!',
};

const URGENCY_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  urgent: { bg: '#FEE2E2', text: '#DC2626' },
  today: { bg: '#FEF3C7', text: '#D97706' },
  tomorrow: { bg: '#DBEAFE', text: '#2563EB' },
  this_week: { bg: '#E0F2FE', text: '#0369A1' },
  flexible: { bg: '#F3F4F6', text: '#6B7280' },
};

interface JobItem {
  id: string;
  title: string;
  description: string;
  distance_km?: number;
  budget?: number;
  budget_max?: number;
  created_at: string;
  location_label?: string;
  bid_count?: number;
  urgency?: string;
  job_type?: string;
  already_bid?: boolean;
  category?: { name_en: string; icon_emoji?: string };
}

export default function ArtisanJobFeed() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const {
    data: jobs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['open-jobs'],
    queryFn: () => api.get('/jobs/available').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/artisans/categories').then((r) => r.data),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let list = jobs as JobItem[];
    if (urgencyFilter) list = list.filter((j) => j.urgency === urgencyFilter);
    if (categoryFilter) list = list.filter((j) => j.category?.name_en === categoryFilter);
    return list;
  }, [jobs, urgencyFilter, categoryFilter]);

  const urgentCount = (jobs as JobItem[]).filter(
    (j) => j.urgency === 'urgent' || j.urgency === 'today',
  ).length;
  const activeFilters = [urgencyFilter, categoryFilter].filter(Boolean).length;

  const renderItem = ({ item }: { item: JobItem }) => {
    const urgencyColor = URGENCY_BADGE_COLORS[item.urgency ?? 'flexible'];
    return (
      <TouchableOpacity
        accessibilityLabel={`View job: ${item.title}`}
        onPress={() => router.push(`/(artisan)/jobs/${item.id}`)}
        className="bg-card rounded-3xl border border-border p-5 mb-3 mx-4"
        style={{ opacity: item.already_bid ? 0.72 : 1 }}
      >
        {/* Top row: category + time */}
        <View className="flex-row items-center justify-between mb-2.5">
          <View className="flex-row items-center gap-2 flex-1 flex-wrap">
            {item.category && (
              <View className="bg-primary/10 px-2.5 py-1 rounded-full">
                <Text className="text-primary text-[11px] font-bold">
                  {item.category.icon_emoji} {item.category.name_en}
                </Text>
              </View>
            )}
            {item.urgency && item.urgency !== 'flexible' && (
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: urgencyColor.bg }}
              >
                <Text className="text-[10px] font-bold" style={{ color: urgencyColor.text }}>
                  {URGENCY_LABELS[item.urgency]}
                </Text>
              </View>
            )}
            {item.already_bid && (
              <View className="bg-green-100 px-2 py-1 rounded-full">
                <Text className="text-green-700 text-[10px] font-bold">✓ Bid sent</Text>
              </View>
            )}
          </View>
          <Text className="text-[10px] text-muted-foreground ml-2 shrink-0">
            {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ''}
          </Text>
        </View>

        {/* Title & description */}
        <Text className="text-base font-extrabold text-foreground mb-1 leading-tight">
          {item.title}
        </Text>
        <Text className="text-sm text-muted-foreground leading-5 mb-3" numberOfLines={2}>
          {item.description}
        </Text>

        {/* Bottom row: budget, location, bids, CTA */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-wrap flex-1">
            {item.budget ? (
              <Text className="text-sm font-bold text-foreground">
                💰 {formatRWF(item.budget)}
                {item.budget_max ? `–${formatRWF(item.budget_max)}` : ''} RWF
              </Text>
            ) : (
              <Text className="text-[11px] text-muted-foreground">💰 Open budget</Text>
            )}
            {item.location_label && (
              <View className="flex-row items-center gap-1">
                <MapPin size={11} color="#6B7280" />
                <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                  {item.location_label}
                </Text>
              </View>
            )}
            <Text className="text-[11px] text-muted-foreground">
              {item.bid_count ?? 0} bid{(item.bid_count ?? 0) !== 1 ? 's' : ''}
            </Text>
          </View>
          {!item.already_bid && (
            <View className="flex-row items-center gap-1 bg-accent rounded-xl px-3 py-1.5 ml-2">
              <Text className="text-white text-xs font-bold">Bid</Text>
              <ArrowRight size={12} color="white" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="pt-14 pb-4 px-5 bg-primary">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className="text-white text-2xl font-extrabold">Open Jobs</Text>
            <Text className="text-white/80 text-sm mt-0.5">
              Matching your skills · {filtered.length} available
              {urgentCount > 0 ? ` · ${urgentCount} urgent` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            accessibilityLabel="Filter jobs"
            className="bg-white/20 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
          >
            <Filter size={14} color="white" />
            <Text className="text-white text-xs font-bold">
              Filter{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick urgency pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
          {['today', 'urgent', 'tomorrow', 'this_week'].map((u) => {
            const count = (jobs as JobItem[]).filter((j) => j.urgency === u).length;
            if (!count) return null;
            return (
              <TouchableOpacity
                key={u}
                onPress={() => setUrgencyFilter(urgencyFilter === u ? null : u)}
                className={`mr-2 px-3 py-1.5 rounded-full border ${
                  urgencyFilter === u ? 'bg-white border-white' : 'bg-white/20 border-white/40'
                }`}
              >
                <Text className={`text-xs font-bold ${urgencyFilter === u ? 'text-primary' : 'text-white'}`}>
                  {URGENCY_LABELS[u]} · {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1B5E3B" />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center mt-24 px-8">
              <View className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
                <Briefcase size={28} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-bold text-center">
                {activeFilters > 0 ? 'No jobs match filters' : 'No jobs right now'}
              </Text>
              <Text className="text-muted-foreground text-center text-sm mt-2">
                {activeFilters > 0
                  ? 'Try removing some filters.'
                  : 'New jobs are posted daily. Pull down to refresh.'}
              </Text>
              {activeFilters > 0 && (
                <TouchableOpacity
                  onPress={() => { setUrgencyFilter(null); setCategoryFilter(null); }}
                  className="mt-4 bg-primary px-5 py-3 rounded-2xl"
                >
                  <Text className="text-white font-bold">Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={filterModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-card rounded-t-3xl px-5 pt-5 pb-10">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-lg font-extrabold">Filter Jobs</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Text className="text-primary font-bold">Done</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold uppercase text-muted-foreground mb-2">Urgency</Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {Object.entries(URGENCY_LABELS).map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setUrgencyFilter(urgencyFilter === val ? null : val)}
                  className={`px-3 py-2 rounded-xl border-2 ${
                    urgencyFilter === val ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${urgencyFilter === val ? 'text-primary' : 'text-foreground'}`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs font-bold uppercase text-muted-foreground mb-2">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {(categories as { id: string; name_en: string; icon_emoji?: string }[]).map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryFilter(categoryFilter === cat.name_en ? null : cat.name_en)}
                  className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border-2 ${
                    categoryFilter === cat.name_en
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <Text style={{ fontSize: 14 }}>{cat.icon_emoji}</Text>
                  <Text
                    className={`text-xs font-bold ${
                      categoryFilter === cat.name_en ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {cat.name_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(urgencyFilter || categoryFilter) && (
              <TouchableOpacity
                onPress={() => { setUrgencyFilter(null); setCategoryFilter(null); setFilterModalVisible(false); }}
                className="mt-5 bg-destructive/10 py-3 rounded-2xl items-center"
              >
                <Text className="text-destructive font-bold">Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
