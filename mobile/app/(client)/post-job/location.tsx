// File: mobile/app/(client)/post-job/location.tsx
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import MapView, { Marker, UrlTile, Region } from 'react-native-maps';
import Toast from 'react-native-toast-message';

const KIGALI: Region = {
  latitude: -1.9441,
  longitude: 30.0619,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function JobLocation() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(KIGALI);
  const [marker, setMarker] = useState({ latitude: KIGALI.latitude, longitude: KIGALI.longitude });
  const [locationLabel, setLocationLabel] = useState('');
  const [gettingLocation, setGettingLocation] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Toast.show({ type: 'info', text1: 'Using Kigali as default location' });
          setGettingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setMarker(coords);
        const newRegion = { ...KIGALI, ...coords };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 800);

        // Reverse geocode for label
        const [address] = await Location.reverseGeocodeAsync(coords);
        if (address) {
          const label = [address.street, address.district, address.city]
            .filter(Boolean)
            .join(', ');
          setLocationLabel(label || 'My location');
        }
      } catch {
        // Silently fall back to Kigali
      } finally {
        setGettingLocation(false);
      }
    })();
  }, []);

  const handleMapPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const coords = e.nativeEvent.coordinate;
    setMarker(coords);
    // Reverse geocode the pin
    try {
      const [address] = await Location.reverseGeocodeAsync(coords);
      if (address) {
        const label = [address.street, address.district, address.city].filter(Boolean).join(', ');
        setLocationLabel(label || '');
      }
    } catch { /* ignore */ }
  };

  const handleConfirm = () => {
    router.push({
      pathname: '/(client)/post-job/confirm',
      params: {
        ...params,
        latitude: marker.latitude.toString(),
        longitude: marker.longitude.toString(),
        locationLabel: locationLabel || 'Custom Location',
      },
    });
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="pt-14 pb-4 px-5 bg-card border-b border-border">
        <Text className="text-xl font-extrabold">Where is the job?</Text>
        <View className="flex-row mt-2">
          {[1, 2, 3].map((s) => (
            <View key={s} className={`h-1 flex-1 rounded-full mr-1 ${s <= 2 ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </View>
      </View>

      {/* Map */}
      <View className="flex-1">
        {gettingLocation && (
          <View className="absolute inset-0 z-10 items-center justify-center bg-background/60">
            <ActivityIndicator color="#1B5E3B" size="large" />
            <Text className="text-sm text-muted-foreground mt-2">Getting your location…</Text>
          </View>
        )}
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={KIGALI}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          accessibilityLabel="Map - tap to set job location"
        >
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
          <Marker
            coordinate={marker}
            title="Job location"
            pinColor="#1B5E3B"
          />
        </MapView>

        {/* Instruction badge */}
        <View className="absolute top-4 left-4 right-4 bg-card/95 rounded-2xl px-4 py-2.5 shadow-sm border border-border">
          <Text className="text-xs text-muted-foreground text-center font-medium">
            📍 Tap anywhere on the map to set the exact location
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View className="bg-card border-t border-border px-5 pb-8 pt-4">
        <View className="mb-3">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Location Label (optional)
          </Text>
          <TextInput
            value={locationLabel}
            onChangeText={setLocationLabel}
            placeholder="e.g. Kiyovu, near Chez Lando Hotel"
            className="bg-muted/30 border border-border rounded-xl px-4 py-3 text-foreground text-sm"
          />
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          accessibilityLabel="Confirm location"
          className="bg-primary rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-extrabold text-base">Confirm Location ✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
