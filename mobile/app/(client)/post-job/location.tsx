// File: mobile/app/(client)/post-job/location.tsx
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, UrlTile, Region } from 'react-native-maps';
import Toast from 'react-native-toast-message';

import {
  RwandaAddressPicker,
  type RwandaAddress,
} from '../../../src/components/RwandaAddressPicker';

const KIGALI: Region = {
  latitude: -1.9441,
  longitude: 30.0619,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

// District approximate centers for map zoom
const DISTRICT_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  Gasabo: { latitude: -1.8845, longitude: 30.1167 },
  Kicukiro: { latitude: -1.9769, longitude: 30.0985 },
  Nyarugenge: { latitude: -1.95, longitude: 30.0588 },
  Musanze: { latitude: -1.4991, longitude: 29.6346 },
  Huye: { latitude: -2.5967, longitude: 29.7397 },
  Rubavu: { latitude: -1.6812, longitude: 29.35 },
  Nyagatare: { latitude: -1.2985, longitude: 30.3263 },
};

export default function JobLocation() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region>(KIGALI);
  const [marker, setMarker] = useState({ latitude: KIGALI.latitude, longitude: KIGALI.longitude });
  const [gettingLocation, setGettingLocation] = useState(true);
  const [address, setAddress] = useState<Partial<RwandaAddress>>({
    province: 'Kigali City',
    district: 'Gasabo',
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setMarker(coords);
          const newRegion = { ...KIGALI, ...coords };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 800);
        }
      } catch {
        /* fall back to Kigali */
      } finally {
        setGettingLocation(false);
      }
    })();
  }, []);

  // Zoom map when district changes
  useEffect(() => {
    if (address.district && DISTRICT_CENTERS[address.district]) {
      const center = DISTRICT_CENTERS[address.district];
      const newRegion = { ...center, latitudeDelta: 0.06, longitudeDelta: 0.06 };
      setRegion(newRegion);
      setMarker(center);
      mapRef.current?.animateToRegion(newRegion, 600);
    }
  }, [address.district]);

  const handleMapPress = async (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const coords = e.nativeEvent.coordinate;
    setMarker(coords);
  };

  const handleConfirm = () => {
    if (!address.district) {
      Toast.show({ type: 'error', text1: 'Select a district', text2: 'Required to post the job' });
      return;
    }
    router.push({
      pathname: '/(client)/post-job/confirm',
      params: {
        ...params,
        latitude: marker.latitude.toString(),
        longitude: marker.longitude.toString(),
        locationLabel: address.formatted ?? address.district,
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
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 4 }}>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Map */}
        <View style={{ height: 220, position: 'relative' }}>
          {gettingLocation && (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(249,250,251,0.8)',
              }}
            >
              <ActivityIndicator color="#1B5E3B" size="large" />
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                Getting your location…
              </Text>
            </View>
          )}
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={KIGALI}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            accessibilityLabel="Map — tap to pin the exact job location"
          >
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />
            <Marker coordinate={marker} title="Job location" pinColor="#1B5E3B" />
          </MapView>
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              backgroundColor: 'rgba(255,255,255,0.95)',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Text
              style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', fontWeight: '500' }}
            >
              📍 Tap on the map to pin the exact spot
            </Text>
          </View>
        </View>

        {/* Address picker */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 }}>
            Full Address <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <RwandaAddressPicker value={address} onChange={(addr) => setAddress(addr)} />
        </View>
      </ScrollView>

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
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Confirm Location ✓</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
