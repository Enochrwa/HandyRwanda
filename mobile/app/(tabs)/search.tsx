// File: mobile/app/(tabs)/search.tsx
/**
 * Search / Browse Artisans screen
 * - List view (default) + Map view toggle
 * - MapView only rendered on native (Platform.OS !== 'web') to avoid crash
 * - Aligned with backend /artisans/search endpoint
 */
import { Search, Filter, MapIcon, List, Star, X, MapPin } from '@icons';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Switch,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';

import api from '../../src/services/api';

// Safe MapView import — only on native
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
}

const KIGALI_REGION = {
  latitude: -1.9441,
  longitude: 30.0619,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const ALL_DISTRICTS = [
  'Gasabo',
  'Kicukiro',
  'Nyarugenge',
  'Bugesera',
  'Gatsibo',
  'Kayonza',
  'Kirehe',
  'Ngoma',
  'Nyagatare',
  'Rwamagana',
  'Burera',
  'Gakenke',
  'Gicumbi',
  'Musanze',
  'Rulindo',
  'Gisagara',
  'Huye',
  'Kamonyi',
  'Muhanga',
  'Nyamagabe',
  'Nyanza',
  'Nyaruguru',
  'Ruhango',
  'Karongi',
  'Ngororero',
  'Nyabihu',
  'Nyamasheke',
  'Rubavu',
  'Rusizi',
  'Rutsiro',
];

const STAR_RATINGS = [3, 4, 5] as const;

type Artisan = {
  id: string;
  full_name: string;
  avatar_url?: string;
  average_rating: number;
  total_reviews: number;
  is_available: boolean;
  verification_status?: string;
  hourly_rate?: number;
  fixed_rate?: number;
  lat?: number;
  lng?: number;
  distance_km?: number;
  category?: string;
  category_name?: string;
  district?: string;
};

// ── Artisan List Card ────────────────────────────────────────────────────────

const ArtisanCard = React.memo(({ item, onPress }: { item: Artisan; onPress: () => void }) => (
  <TouchableOpacity
    accessibilityLabel={`View ${item.full_name}'s profile`}
    onPress={onPress}
    className="bg-card p-4 rounded-2xl mb-3 border border-border flex-row items-center"
  >
    {/* Avatar */}
    <View className="w-16 h-16 rounded-2xl bg-primary/10 overflow-hidden items-center justify-center">
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} className="w-full h-full" resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: 28 }}>👷</Text>
      )}
    </View>

    <View className="ml-4 flex-1">
      <View className="flex-row justify-between items-start">
        <Text className="text-base font-bold text-foreground flex-1 mr-2" numberOfLines={1}>
          {item.full_name}
        </Text>
        <View className="flex-row items-center">
          <Star size={13} color="#E8A020" fill="#E8A020" />
          <Text className="ml-1 text-sm font-bold">{item.average_rating?.toFixed(1) ?? '—'}</Text>
          <Text className="text-[10px] text-muted-foreground ml-0.5">
            ({item.total_reviews ?? 0})
          </Text>
        </View>
      </View>

      {item.category && (
        <Text className="text-muted-foreground text-xs mt-0.5">{item.category}</Text>
      )}

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-primary font-bold text-sm">
          {item.hourly_rate
            ? `${item.hourly_rate.toLocaleString()} RWF/hr`
            : item.fixed_rate
              ? `${item.fixed_rate.toLocaleString()} RWF fixed`
              : 'Contact for price'}
        </Text>
        <View className="flex-row items-center gap-2">
          {item.distance_km !== undefined && (
            <View className="flex-row items-center">
              <MapPin size={10} color="#6B6B6B" />
              <Text className="text-[10px] text-muted-foreground ml-0.5">
                {item.distance_km.toFixed(1)} km
              </Text>
            </View>
          )}
          {item.is_available && (
            <View className="bg-success/10 px-2 py-0.5 rounded-full">
              <Text className="text-success text-[10px] font-bold">AVAIL.</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  </TouchableOpacity>
));

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const params = useLocalSearchParams<{ categoryId?: string; q?: string }>();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState(params.q ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  const [filters, setFilters] = useState({
    districts: [] as string[],
    categoryId: params.categoryId ?? '',
    minPrice: '',
    maxPrice: '',
    availableNow: false,
    minRating: 0,
  });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/artisans/categories').then((r) => r.data),
  });

  const { data: artisansData, isLoading } = useQuery({
    queryKey: ['artisans', debouncedQuery, filters],
    queryFn: () =>
      api
        .get('/artisans/search', {
          params: {
            q: debouncedQuery || undefined,
            latitude: KIGALI_REGION.latitude,
            longitude: KIGALI_REGION.longitude,
            radius_km: 50,
            district: filters.districts.length ? filters.districts.join(',') : undefined,
            category_id: filters.categoryId || undefined,
            min_hourly_rate: filters.minPrice || undefined,
            max_hourly_rate: filters.maxPrice || undefined,
            available_now: filters.availableNow || undefined,
            min_rating: filters.minRating || undefined,
          },
        })
        .then((r) => {
            // Backend /artisans/search returns a plain array
            const items = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
            return items;
          }),
    placeholderData: keepPreviousData,
  });

  const artisans: Artisan[] = artisansData ?? [];

  const activeFilterCount = [
    filters.districts.length > 0,
    !!filters.categoryId,
    !!filters.minPrice,
    !!filters.maxPrice,
    filters.availableNow,
    filters.minRating > 0,
  ].filter(Boolean).length;

  const resetFilters = useCallback(
    () =>
      setFilters({
        districts: [],
        categoryId: '',
        minPrice: '',
        maxPrice: '',
        availableNow: false,
        minRating: 0,
      }),
    [],
  );

  return (
    <View className="flex-1 bg-background">
      {/* ── Search & Controls ──────────────────────────────────────────── */}
      <View className="px-4 pt-3 pb-3 bg-card border-b border-border gap-2">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-muted px-3 py-2.5 rounded-xl">
            <Search size={18} color="#6B6B6B" />
            <TextInput
              className="flex-1 ml-2 text-foreground text-sm"
              placeholder="Plumbers, electricians, cleaners…"
              placeholderTextColor="#6B6B6B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery !== '' && (
              <TouchableOpacity
                accessibilityLabel="Clear search"
                onPress={() => setSearchQuery('')}
              >
                <X size={16} color="#6B6B6B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            accessibilityLabel="Open filters"
            onPress={() => setShowFilters(true)}
            className="relative w-10 h-10 bg-muted rounded-xl items-center justify-center"
          >
            <Filter size={18} color="#1B5E3B" />
            {activeFilterCount > 0 && (
              <View className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full items-center justify-center">
                <Text className="text-white text-[9px] font-bold">{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* List / Map toggle (native only) */}
          {Platform.OS !== 'web' && (
            <View className="flex-row bg-muted rounded-xl overflow-hidden">
              <TouchableOpacity
                accessibilityLabel="List view"
                onPress={() => setViewMode('list')}
                className={`px-3 py-2.5 ${viewMode === 'list' ? 'bg-primary' : ''}`}
              >
                <List size={18} color={viewMode === 'list' ? 'white' : '#6B6B6B'} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Map view"
                onPress={() => setViewMode('map')}
                className={`px-3 py-2.5 ${viewMode === 'map' ? 'bg-primary' : ''}`}
              >
                <MapIcon size={18} color={viewMode === 'map' ? 'white' : '#6B6B6B'} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Result count */}
        {!isLoading && (
          <Text className="text-xs text-muted-foreground pl-1">
            {artisans.length} artisan{artisans.length !== 1 ? 's' : ''} found
            {debouncedQuery ? ` for "${debouncedQuery}"` : ' near Kigali'}
          </Text>
        )}
      </View>

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
          <Text className="text-muted-foreground text-sm mt-3">Finding artisans…</Text>
        </View>
      )}

      {/* ── List View ─────────────────────────────────────────────────── */}
      {!isLoading && viewMode === 'list' && (
        <FlatList
          data={artisans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <ArtisanCard item={item} onPress={() => router.push(`/artisan/${item.id}`)} />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center mt-20 px-8">
              <Text style={{ fontSize: 48 }}>🔍</Text>
              <Text className="text-lg font-bold text-foreground mt-4 text-center">
                No artisans found
              </Text>
              <Text className="text-muted-foreground text-sm text-center mt-2">
                Try a different search term or clear your filters
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  accessibilityLabel="Reset filters"
                  onPress={resetFilters}
                  className="mt-4 bg-primary px-6 py-3 rounded-xl"
                >
                  <Text className="text-white font-bold">Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── Map View (native only) ─────────────────────────────────────── */}
      {!isLoading && viewMode === 'map' && Platform.OS !== 'web' && MapView && (
        <MapView style={{ flex: 1 }} initialRegion={KIGALI_REGION}>
          {artisans
            .filter((a) => a.lat && a.lng)
            .map((a) => (
              <Marker
                key={a.id}
                coordinate={{ latitude: a.lat!, longitude: a.lng! }}
                title={a.full_name}
              >
                <Callout onPress={() => router.push(`/artisan/${a.id}`)}>
                  <View style={{ padding: 8, minWidth: 140 }}>
                    <Text style={{ fontWeight: 'bold' }}>{a.full_name}</Text>
                    <Text style={{ fontSize: 12, color: '#6B6B6B' }}>
                      ⭐ {a.average_rating?.toFixed(1) ?? '—'} ({a.total_reviews ?? 0} reviews)
                    </Text>
                    {a.hourly_rate && (
                      <Text
                        style={{ fontSize: 12, color: '#1B5E3B', fontWeight: '600', marginTop: 2 }}
                      >
                        {a.hourly_rate.toLocaleString()} RWF/hr
                      </Text>
                    )}
                    <Text
                      style={{ fontSize: 11, color: '#1B5E3B', marginTop: 4, fontWeight: '600' }}
                    >
                      Tap to view profile →
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}
        </MapView>
      )}

      {/* ── Filter Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-[32px] h-[85%] p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold">Filters</Text>
              <TouchableOpacity
                accessibilityLabel="Close filters"
                onPress={() => setShowFilters(false)}
              >
                <X size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* District */}
              <Text className="text-base font-bold mb-3">District</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                <View className="flex-row gap-2 pr-4">
                  {ALL_DISTRICTS.slice(0, 12).map((d) => {
                    const active = filters.districts.includes(d);
                    return (
                      <TouchableOpacity
                        accessibilityLabel={`Filter by ${d}`}
                        key={d}
                        onPress={() => {
                          const next = active
                            ? filters.districts.filter((x) => x !== d)
                            : [...filters.districts, d];
                          setFilters({ ...filters, districts: next });
                        }}
                        className={`px-4 py-2 rounded-full border ${active ? 'bg-primary/10 border-primary' : 'bg-muted border-transparent'}`}
                      >
                        <Text
                          className={
                            active
                              ? 'text-primary font-bold text-sm'
                              : 'text-muted-foreground text-sm'
                          }
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Category */}
              <Text className="text-base font-bold mb-3">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                <View className="flex-row gap-2 pr-4">
                  {categories?.map((c: any) => {
                    const active = filters.categoryId === c.id;
                    return (
                      <TouchableOpacity
                        accessibilityLabel={`Filter by ${c.name_en ?? c.name}`}
                        key={c.id}
                        onPress={() => setFilters({ ...filters, categoryId: active ? '' : c.id })}
                        className={`px-4 py-2 rounded-full border ${active ? 'bg-primary/10 border-primary' : 'bg-muted border-transparent'}`}
                      >
                        <Text
                          className={
                            active
                              ? 'text-primary font-bold text-sm'
                              : 'text-muted-foreground text-sm'
                          }
                        >
                          {c.name_en ?? c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Price */}
              <Text className="text-base font-bold mb-3">Hourly Rate (RWF)</Text>
              <View className="flex-row items-center gap-3 mb-5">
                <TextInput
                  className="flex-1 bg-muted p-3.5 rounded-xl border border-border text-foreground"
                  placeholder="Min"
                  placeholderTextColor="#6B6B6B"
                  keyboardType="numeric"
                  value={filters.minPrice}
                  onChangeText={(v) => setFilters({ ...filters, minPrice: v })}
                />
                <Text className="text-muted-foreground">—</Text>
                <TextInput
                  className="flex-1 bg-muted p-3.5 rounded-xl border border-border text-foreground"
                  placeholder="Max"
                  placeholderTextColor="#6B6B6B"
                  keyboardType="numeric"
                  value={filters.maxPrice}
                  onChangeText={(v) => setFilters({ ...filters, maxPrice: v })}
                />
              </View>

              {/* Available now */}
              <View className="flex-row justify-between items-center mb-5">
                <View>
                  <Text className="text-base font-bold">Available Now</Text>
                  <Text className="text-xs text-muted-foreground">
                    Show only artisans ready to work today
                  </Text>
                </View>
                <Switch
                  value={filters.availableNow}
                  onValueChange={(v) => setFilters({ ...filters, availableNow: v })}
                  trackColor={{ false: '#E2E8F0', true: '#1B5E3B' }}
                  thumbColor="white"
                />
              </View>

              {/* Min Rating */}
              <Text className="text-base font-bold mb-3">Minimum Rating</Text>
              <View className="flex-row gap-3 mb-10">
                {STAR_RATINGS.map((r) => (
                  <TouchableOpacity
                    accessibilityLabel={`Minimum ${r} stars`}
                    key={r}
                    onPress={() =>
                      setFilters({ ...filters, minRating: filters.minRating === r ? 0 : r })
                    }
                    className={`flex-row items-center gap-1 px-4 py-2 rounded-full border ${filters.minRating === r ? 'bg-accent/20 border-accent' : 'bg-muted border-transparent'}`}
                  >
                    <Star size={14} color="#E8A020" fill="#E8A020" />
                    <Text
                      className={`font-bold text-sm ${filters.minRating === r ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {r}+
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 pt-4 border-t border-border">
              <TouchableOpacity
                accessibilityLabel="Reset all filters"
                onPress={() => {
                  resetFilters();
                  setShowFilters(false);
                }}
                className="flex-1 p-4 rounded-xl items-center border border-border"
              >
                <Text className="font-bold text-foreground">Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Apply filters"
                onPress={() => setShowFilters(false)}
                className="flex-[2] bg-primary p-4 rounded-xl items-center"
              >
                <Text className="text-white font-bold">Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
