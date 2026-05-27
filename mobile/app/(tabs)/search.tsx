import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Modal, Switch, ScrollView } from 'react-native';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Search, Filter, Map as MapIcon, List, Star, X } from 'lucide-react-native';
import api from '../../src/services/api';

const KIGALI_REGION = {
  latitude: -1.9441,
  longitude: 30.0619,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const DISTRICTS = ['Nyarugenge', 'Kicukiro', 'Gasabo'];

type Artisan = {
  id: string;
  full_name: string;
  avatar_url?: string;
  average_rating: number;
  total_reviews: number;
  is_available: boolean;
  hourly_rate?: number;
  lat: number;
  lng: number;
  distance_km: number;
};

export default function SearchScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  const [filters, setFilters] = useState({
    districts: [] as string[],
    categories: [] as string[],
    minPrice: '',
    maxPrice: '',
    availableNow: false,
    minRating: 0,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/artisans/categories').then(r => r.data),
  });

  const { data: artisans, isLoading } = useQuery({
    queryKey: ['artisans', searchQuery, filters],
    queryFn: () => api.get('/artisans/search', {
      params: {
        q: searchQuery,
        latitude: KIGALI_REGION.latitude,
        longitude: KIGALI_REGION.longitude,
        radius_km: 20,
        ...filters,
        districts: filters.districts.join(','),
        categories: filters.categories.join(','),
      }
    }).then(r => r.data),
    placeholderData: keepPreviousData,
  });

  const ArtisanCard = React.memo(({ item }: { item: Artisan }) => (
    <TouchableOpacity accessibilityLabel="Button"
      onPress={() => router.push(`/artisan/${item.id}`)}
      className="bg-card p-4 rounded-2xl mb-3 border border-border flex-row items-center"
    >
      <Image
        source={{ uri: item.avatar_url || undefined }}
        className="w-16 h-16 rounded-full bg-muted"
      />
      <View className="ml-4 flex-1">
        <View className="flex-row justify-between items-start">
          <Text className="text-lg font-bold text-foreground">{item.full_name}</Text>
          <View className="flex-row items-center">
            <Star size={14} // @ts-ignore
            color="#E8A020" // @ts-ignore
            fill="#E8A020" />
            <Text className="ml-1 text-sm font-semibold">{item.average_rating}</Text>
          </View>
        </View>
        <Text className="text-muted-foreground text-sm">Plumber • {item.distance_km.toFixed(1)} km away</Text>
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-primary font-bold">{item.hourly_rate ? `${item.hourly_rate} RWF/hr` : 'Contact for price'}</Text>
          {item.is_available && (
            <View className="bg-success/10 px-2 py-0.5 rounded-full">
              <Text className="text-success text-[10px] font-bold">AVAILABLE</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  ));

  return (
    <View className="flex-1 bg-background">
      {/* Header Search Bar */}
      <View className="p-4 bg-card border-b border-border flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center bg-muted px-3 py-2 rounded-xl">
          <Search size={20} // @ts-ignore
            color="#6B6B6B" />
          <TextInput
            className="flex-1 ml-2 text-foreground"
            placeholder="Search artisans..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity accessibilityLabel="Button" onPress={() => setSearchQuery('')}>
              <X size={18} // @ts-ignore
            color="#6B6B6B" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity accessibilityLabel="Button"
          onPress={() => setShowFilters(true)}
          className={`p-2 rounded-xl border ${Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v) ? 'bg-primary/10 border-primary' : 'bg-muted border-transparent onRequestClose={() => setShowFilters(false)}'}`}
        >
          <Filter size={24} // @ts-ignore
            color={Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v) ? '#1B5E3B' : '#1A1A1A'} />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View className="flex-row justify-center my-4">
        <View className="flex-row bg-muted rounded-full p-1">
          <TouchableOpacity accessibilityLabel="Button"
            onPress={() => setViewMode('list')}
            className={`flex-row items-center px-6 py-2 rounded-full ${viewMode === 'list' ? 'bg-card shadow-sm' : ''}`}
          >
            <List size={18} // @ts-ignore
            color={viewMode === 'list' ? '#1B5E3B' : '#6B6B6B'} />
            <Text className={`ml-2 font-bold ${viewMode === 'list' ? 'text-primary' : 'text-muted-foreground'}`}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Button"
            onPress={() => setViewMode('map')}
            className={`flex-row items-center px-6 py-2 rounded-full ${viewMode === 'map' ? 'bg-card shadow-sm' : ''}`}
          >
            <MapIcon size={18} // @ts-ignore
            color={viewMode === 'map' ? '#1B5E3B' : '#6B6B6B'} />
            <Text className={`ml-2 font-bold ${viewMode === 'map' ? 'text-primary' : 'text-muted-foreground'}`}>Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' ? (
        isLoading ? (
          <View className="px-4">
            {[1, 2, 3, 4].map(i => (
              <View key={i} className="animate-pulse rounded-2xl bg-muted h-24 mb-3" />
            ))}
          </View>
        ) : (
          <FlatList
            data={artisans}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <ArtisanCard item={item} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20">
                <Text className="text-muted-foreground">No artisans found</Text>
              </View>
            }
          />
        )
      ) : (
        <MapView
          className="flex-1"
          initialRegion={KIGALI_REGION}
        >
          {artisans?.map((a: Artisan) => (
            <Marker
              key={a.id}
              coordinate={{ latitude: a.lat, longitude: a.lng }}
              title={a.full_name}
            >
              <Callout onPress={() => router.push(`/artisan/${a.id}`)}>
                <View className="p-2 min-w-[120px]">
                  <Text className="font-bold">{a.full_name}</Text>
                  <Text className="text-xs text-muted-foreground">⭐ {a.average_rating}</Text>
                  <Text className="text-xs text-primary font-bold mt-1">View Profile</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-[40px] h-[85%] p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold">Filters</Text>
              <TouchableOpacity accessibilityLabel="Button" onPress={() => setShowFilters(false)}>
                <X size={24} // @ts-ignore
            color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Districts */}
              <Text className="text-lg font-bold mb-3">District</Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {DISTRICTS.map(d => (
                  <TouchableOpacity accessibilityLabel="Button"
                    key={d}
                    onPress={() => {
                      const newDistricts = filters.districts.includes(d)
                        ? filters.districts.filter(item => item !== d)
                        : [...filters.districts, d];
                      setFilters({...filters, districts: newDistricts});
                    }}
                    className={`px-4 py-2 rounded-full border ${filters.districts.includes(d) ? 'bg-primary/10 border-primary' : 'bg-muted border-transparent onRequestClose={() => setShowFilters(false)}'}`}
                  >
                    <Text className={filters.districts.includes(d) ? 'text-primary font-bold' : 'text-muted-foreground'}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Categories */}
              <Text className="text-lg font-bold mb-3">Category</Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {categories?.map((c: any) => (
                  <TouchableOpacity accessibilityLabel="Button"
                    key={c.id}
                    onPress={() => {
                      const newCats = filters.categories.includes(c.id)
                        ? filters.categories.filter(item => item !== c.id)
                        : [...filters.categories, c.id];
                      setFilters({...filters, categories: newCats});
                    }}
                    className={`px-4 py-2 rounded-full border ${filters.categories.includes(c.id) ? 'bg-primary/10 border-primary' : 'bg-muted border-transparent onRequestClose={() => setShowFilters(false)}'}`}
                  >
                    <Text className={filters.categories.includes(c.id) ? 'text-primary font-bold' : 'text-muted-foreground'}>{c.name_en || c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price Range */}
              <Text className="text-lg font-bold mb-3">Price Range (RWF)</Text>
              <View className="flex-row items-center gap-4 mb-6">
                <TextInput
                  className="flex-1 bg-muted p-4 rounded-xl border border-border"
                  placeholder="From"
                  keyboardType="numeric"
                  value={filters.minPrice}
                  onChangeText={v => setFilters({...filters, minPrice: v})}
                />
                <Text>to</Text>
                <TextInput
                  className="flex-1 bg-muted p-4 rounded-xl border border-border"
                  placeholder="To"
                  keyboardType="numeric"
                  value={filters.maxPrice}
                  onChangeText={v => setFilters({...filters, maxPrice: v})}
                />
              </View>

              {/* Availability */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-lg font-bold">Available Now</Text>
                <Switch
                  value={filters.availableNow}
                  onValueChange={v => setFilters({...filters, availableNow: v})}
                  trackColor={{ false: '#E2E8F0', true: '#1B5E3B' }}
                />
              </View>

              {/* Rating */}
              <Text className="text-lg font-bold mb-3">Minimum Rating</Text>
              <View className="flex-row gap-4 mb-10">
                {[1, 2, 3, 4, 5].map(r => (
                  <TouchableOpacity accessibilityLabel="Button" key={r} onPress={() => setFilters({...filters, minRating: r})}>
                    <Star size={32} // @ts-ignore
            color={r <= filters.minRating ? '#E8A020' : '#E2E8F0'} // @ts-ignore
            fill={r <= filters.minRating ? '#E8A020' : 'transparent onRequestClose={() => setShowFilters(false)}'} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row gap-4 mt-auto pt-4 border-t border-border">
              <TouchableOpacity accessibilityLabel="Button"
                onPress={() => setFilters({ districts: [], categories: [], minPrice: '', maxPrice: '', availableNow: false, minRating: 0 })}
                className="flex-1 p-4 rounded-xl items-center border border-border"
              >
                <Text className="font-bold">Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Button"
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
