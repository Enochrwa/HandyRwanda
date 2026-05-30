import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

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
  const [, setArtisans] = useState<ArtisanSearchResult[]>([]);

  useEffect(() => {
    fetchArtisans();
  }, []);

  const fetchArtisans = async () => {
    try {
      const res = await api.get('/artisans/search', {
        params: { latitude: -1.9441, longitude: 30.0619, radius_km: 10 },
      });
      setArtisans(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center bg-muted">
        <Text className="text-4xl mb-4">🗺️</Text>
        <Text className="text-lg font-bold text-foreground mb-2">
          Map view not available on web
        </Text>
        <Text className="text-sm text-muted-foreground text-center px-8">
          Use the list view to browse artisans, or open the app on mobile for map search.
        </Text>
      </View>
    </View>
  );
}
