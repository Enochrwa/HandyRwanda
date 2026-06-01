// File: mobile/app/(client)/search/map.native.tsx
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import api from '../../../src/services/api';

interface ArtisanSearchResult {
  id: string;
  lat: number;
  lng: number;
  avatar_url?: string;
  full_name: string;
  average_rating: number;
  distance_km: number;
}

export default function ArtisanMapSearch() {
  const router = useRouter();
  const [region, setRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [artisans, setArtisans] = useState<ArtisanSearchResult[]>([]);
  const [selectedArtisan, setSelectedArtisan] = useState<ArtisanSearchResult | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const initialRegion = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(initialRegion);
      fetchArtisans(loc.coords.latitude, loc.coords.longitude);
    })();
  }, []);

  const fetchArtisans = async (lat: number, lng: number) => {
    try {
      const res = await api.get('/artisans/search', {
        params: { latitude: lat, longitude: lng, radius_km: 10 },
      });
      // Backend returns plain array; guard against future {items} shape
      const items: ArtisanSearchResult[] = Array.isArray(res.data)
        ? res.data
        : (res.data?.items ?? []);
      setArtisans(items);
    } catch (error) {
      console.error(error);
    }
  };

  const onMarkerPress = (artisan: ArtisanSearchResult) => {
    setSelectedArtisan(artisan);
    bottomSheetRef.current?.expand();
  };

  if (!region) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View className="flex-1">
      <MapView
        className="flex-1"
        initialRegion={region}
        onRegionChangeComplete={(r: { latitude: number; longitude: number }) =>
          fetchArtisans(r.latitude, r.longitude)
        }
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {artisans.map((a) => (
          <Marker
            key={a.id}
            coordinate={{
              latitude: a.lat || region.latitude,
              longitude: a.lng || region.longitude,
            }}
            onPress={() => onMarkerPress(a)}
          >
            <View className="w-10 h-10 rounded-full border-2 border-primary bg-white overflow-hidden">
              {a.avatar_url ? (
                <Image source={{ uri: a.avatar_url }} className="w-full h-full" />
              ) : (
                <View className="flex-1 bg-primary" />
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      <BottomSheet ref={bottomSheetRef} index={-1} snapPoints={['30%']} enablePanDownToClose>
        <BottomSheetView className="p-6">
          {selectedArtisan && (
            <View>
              <View className="flex-row items-center mb-6">
                {selectedArtisan.avatar_url && (
                  <Image
                    source={{ uri: selectedArtisan.avatar_url }}
                    className="w-16 h-16 rounded-full mr-4"
                  />
                )}
                <View className="flex-1">
                  <Text className="text-base font-bold">{selectedArtisan.full_name}</Text>
                  <Text className="text-xs text-muted-foreground">
                    ⭐ {selectedArtisan.average_rating} • {selectedArtisan.distance_km.toFixed(1)}{' '}
                    km
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                className="bg-primary p-4 rounded-xl items-center"
                onPress={() => router.push(`/artisan/${selectedArtisan.id}`)}
              >
                <Text className="text-white font-bold">View Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
