// File: mobile/app/(artisan)/onboarding/step3-location.tsx
/**
 * Step 3 of 4 — Service Area & Address
 *
 * Collects:
 *   1. GPS pin on map (service centre)
 *   2. Service radius slider
 *   3. Structured Rwanda address (province → district → sector → cell →
 *      village → street/road → house number → landmark)
 *
 * Saves all fields to /artisans/profile and /auth/me (profile update).
 */
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import Toast from 'react-native-toast-message';

import {
  RwandaAddressPicker,
  type RwandaAddress,
} from '../../../src/components/RwandaAddressPicker';
import api from '../../../src/services/api';

const KIGALI_CENTER = {
  latitude: -1.9441,
  longitude: 30.0619,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function LocationStep() {
  const router = useRouter();
  const [region, setRegion] = useState(KIGALI_CENTER);
  const [radiusKm, setRadiusKm] = useState(10);
  const [marker, setMarker] = useState({ latitude: -1.9441, longitude: 30.0619 });
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<RwandaAddress>({
    province: 'Kigali City',
    district: 'Gasabo',
    sector: '',
    cell: '',
    village: '',
    street_road: '',
    house_number: '',
    landmark: '',
    formatted: 'Gasabo, Kigali City, Rwanda',
  });

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'Cannot access your location. Please pick manually.',
      });
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const newCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setMarker(newCoords);
    setRegion({ ...KIGALI_CENTER, ...newCoords });
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const handleNext = async () => {
    if (!address.district) {
      Toast.show({
        type: 'error',
        text1: 'Missing district',
        text2: 'Please select your district.',
      });
      return;
    }
    setLoading(true);
    try {
      // Save artisan profile (service area GPS + radius + full structured address)
      await api.post('/artisans/profile', {
        latitude: marker.latitude,
        longitude: marker.longitude,
        service_radius_km: radiusKm,
        location_label: address.formatted,
        province: address.province || undefined,
        district: address.district || undefined,
        sector: address.sector || undefined,
        cell: address.cell || undefined,
        village: address.village || undefined,
        street_road: address.street_road || undefined,
        house_number: address.house_number || undefined,
        landmark: address.landmark || undefined,
      });

      // Mirror full address to the user profile record
      await api.patch('/auth/profile', {
        province: address.province || undefined,
        district: address.district || undefined,
        sector: address.sector || undefined,
        cell: address.cell || undefined,
        village: address.village || undefined,
        street_road: address.street_road || undefined,
        house_number: address.house_number || undefined,
        landmark: address.landmark || undefined,
      });

      router.push('/(artisan)/onboarding/step4-id');
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="p-6 pt-10">
          <Text className="text-2xl font-bold text-foreground">Where do you work?</Text>
          <Text className="text-muted-foreground text-sm mt-1">
            Step 3 of 4 · Set your service area and home address
          </Text>
        </View>

        {/* Map */}
        <MapView
          style={{ height: 220, marginHorizontal: 0 }}
          initialRegion={region}
          onPress={(e) => setMarker(e.nativeEvent.coordinate)}
        >
          <Marker
            coordinate={marker}
            draggable
            onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
            pinColor="#1B5E3B"
          />
          <Circle
            center={marker}
            radius={radiusKm * 1000}
            fillColor="rgba(27, 94, 59, 0.12)"
            strokeColor="rgba(27, 94, 59, 0.45)"
            strokeWidth={1.5}
          />
        </MapView>

        <View className="p-6 gap-5">
          {/* Radius slider */}
          <View className="bg-card rounded-2xl border border-border p-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-base font-bold text-foreground">
                Service Radius: {radiusKm} km
              </Text>
              <TouchableOpacity onPress={getCurrentLocation}>
                <Text className="text-primary font-semibold text-sm">📍 My Location</Text>
              </TouchableOpacity>
            </View>
            <Slider
              style={{ width: '100%', height: 36 }}
              minimumValue={1}
              maximumValue={50}
              step={1}
              value={radiusKm}
              onValueChange={setRadiusKm}
              minimumTrackTintColor="#1B5E3B"
              maximumTrackTintColor="#E2E8F0"
            />
            <Text className="text-muted-foreground text-[11px] text-center mt-1">
              GPS: {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
            </Text>
          </View>

          {/* Structured address */}
          <View className="bg-card rounded-2xl border border-border p-4">
            <Text className="text-base font-bold text-foreground mb-1">Your Home Address</Text>
            <Text className="text-xs text-muted-foreground mb-4">
              This helps clients near you discover your profile first.
            </Text>
            <RwandaAddressPicker value={address} onChange={setAddress} />
          </View>

          {/* CTA */}
          <TouchableOpacity
            className="bg-primary p-4 rounded-xl items-center"
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Next: ID Verification →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
