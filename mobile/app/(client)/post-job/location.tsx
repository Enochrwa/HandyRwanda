/**
 * Job Location screen (Step 2 of 3).
 *
 * Uses the new <LocationPicker> which:
 *  - Is offline-first (no API calls for Rwanda hierarchy)
 *  - Supports both Rwanda and international addresses
 *  - Reverse-geocodes map taps via OSM Nominatim
 *  - Has zero re-render-loop issues
 */
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { LocationPicker, type LocationResult } from 'src/components/LocationPicker';

export default function JobLocation() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();

  const [gettingLocation, setGettingLocation] = useState(true);
  const [initialCoords, setInitialCoords] = useState<
    { latitude: number; longitude: number } | undefined
  >(undefined);

  // Store latest picker result in a ref to avoid re-renders on every change
  const resultRef = useRef<LocationResult | null>(null);

  // Get GPS on mount once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status: _ex } = await Location.getForegroundPermissionsAsync();
        const status =
          _ex !== 'undetermined'
            ? _ex
            : (await Location.requestForegroundPermissionsAsync()).status;
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (mounted) {
            setInitialCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        }
      } catch {
        // Fall back to Kigali default inside LocationPicker
      } finally {
        if (mounted) setGettingLocation(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLocationChange = useCallback((result: LocationResult) => {
    resultRef.current = result;
  }, []);

  const handleConfirm = () => {
    const result = resultRef.current;
    if (!result) {
      Toast.show({
        type: 'error',
        text1: 'Select a location',
        text2: 'Pin the map or fill in the address',
      });
      return;
    }
    if (result.rwanda && !result.rwanda.district) {
      Toast.show({ type: 'error', text1: 'Select a district', text2: 'Required to post the job' });
      return;
    }
    router.push({
      pathname: '/(client)/post-job/confirm',
      params: {
        ...params,
        latitude: result.latitude.toString(),
        longitude: result.longitude.toString(),
        locationLabel: result.formatted,
        // Pass the full structured Rwanda address as JSON so confirm.tsx can send it to API
        addressJson: result.rwanda ? JSON.stringify(result.rwanda) : '',
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Where is the job?</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          Step 2 of 3 — Set the location
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: s <= 2 ? '#1B5E3B' : '#E5E7EB',
                marginRight: 4,
              }}
            />
          ))}
        </View>
      </View>

      {gettingLocation ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#1B5E3B" size="large" />
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 10 }}>
            Getting your location…
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginTop: 16 }}>
            <LocationPicker initialCoords={initialCoords} onChange={handleLocationChange} />
          </View>
        </ScrollView>
      )}

      {/* Footer CTA */}
      {!gettingLocation && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingBottom: 32,
            paddingTop: 12,
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
          }}
        >
          <TouchableOpacity
            onPress={handleConfirm}
            style={{
              backgroundColor: '#1B5E3B',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              Confirm Location ✓
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
