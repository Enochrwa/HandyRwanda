import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import Toast from 'react-native-toast-message';
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

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Cannot access your location' });
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
    setLoading(true);
    try {
      await api.post('/artisans/profile', {
        latitude: marker.latitude,
        longitude: marker.longitude,
        service_radius_km: radiusKm,
        location_label: 'Custom Location',
      });
      router.push('/(artisan)/onboarding/step4-id');
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="p-6 pt-10">
        <Text className="text-2xl font-bold text-foreground">Where do you work?</Text>
        <Text className="text-muted-foreground">Step 3 of 4: Set Service Area</Text>
      </View>

      <MapView
        className="flex-1"
        initialRegion={region}
        onPress={(e) => setMarker(e.nativeEvent.coordinate)}
      >
        <Marker
          coordinate={marker}
          draggable
          onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
        />
        <Circle
          center={marker}
          radius={radiusKm * 1000}
          fillColor="rgba(27, 94, 59, 0.2)"
          strokeColor="rgba(27, 94, 59, 0.5)"
        />
      </MapView>

      <View className="p-6 bg-card rounded-t-[32px] shadow-lg">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-bold">Service Radius: {radiusKm} km</Text>
          <TouchableOpacity onPress={getCurrentLocation}>
            <Text className="text-primary font-bold">Use My Location</Text>
          </TouchableOpacity>
        </View>

        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={1}
          maximumValue={50}
          step={1}
          value={radiusKm}
          onValueChange={setRadiusKm}
          minimumTrackTintColor="#1B5E3B"
          maximumTrackTintColor="#E2E8F0"
        />

        <Text className="text-muted-foreground text-xs text-center mb-4">
          Lat: {marker.latitude.toFixed(4)}, Lng: {marker.longitude.toFixed(4)}
        </Text>

        <TouchableOpacity
          className="bg-primary p-4 rounded-xl items-center"
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Next: ID Verification</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
