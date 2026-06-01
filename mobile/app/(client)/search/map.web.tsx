// File: mobile/app/(client)/search/map.web.tsx
/**
 * Web platform stub — MapView with react-native-maps is native-only.
 * On web we show a friendly message directing users to the list view.
 */
import React from 'react';
import { View, Text } from 'react-native';

export default function ArtisanMapSearch() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text style={{ fontSize: 48 }} className="mb-4">🗺️</Text>
      <Text className="text-lg font-bold text-foreground mb-2 text-center">
        Map view not available on web
      </Text>
      <Text className="text-sm text-muted-foreground text-center">
        Use the list view to browse artisans, or open the app on mobile for live map search.
      </Text>
    </View>
  );
}
