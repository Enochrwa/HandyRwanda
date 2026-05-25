import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Circle, UrlTile } from 'react-native-maps';

import api from '../../../services/api';
import { colors, typography, spacing, radius } from '../../../src/theme';

export default function LocationStep() {
  const router = useRouter();
  const [region, setRegion] = useState({
    latitude: -1.9441,
    longitude: 30.0619,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [radiusKm, setRadiusKm] = useState(10);
  const [marker, setMarker] = useState({ latitude: -1.9441, longitude: 30.0619 });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        ...region,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setRegion(newRegion);
      setMarker({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    })();
  }, [region]);

  const handleNext = async () => {
    try {
      await api.post('/artisans/profile', {
        latitude: marker.latitude,
        longitude: marker.longitude,
        service_radius_km: radiusKm,
        location_label: 'Selected on map',
      });
      router.push('/(artisan)/onboarding/step4-id');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Where do you work?</Text>
        <Text style={styles.subtitle}>Step 3 of 4: Set Service Area</Text>
      </View>

      {/* @ts-expect-error - react-native-maps types */}
      <MapView
        style={styles.map}
        initialRegion={region}
        onPress={(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) =>
          setMarker(e.nativeEvent.coordinate)
        }
      >
        {/* @ts-expect-error - react-native-maps types */}
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {/* @ts-expect-error - react-native-maps types */}
        <Marker
          coordinate={marker}
          draggable
          onDragEnd={(e: {
            nativeEvent: { coordinate: { latitude: number; longitude: number } };
          }) => setMarker(e.nativeEvent.coordinate)}
        />
        {/* @ts-expect-error - react-native-maps types */}
        <Circle
          center={marker}
          radius={radiusKm * 1000}
          fillColor="rgba(27, 94, 59, 0.2)"
          strokeColor="rgba(27, 94, 59, 0.5)"
        />
      </MapView>

      <View style={styles.footer}>
        <Text style={styles.label}>Service Radius: {radiusKm} km</Text>
        {/* @ts-expect-error - react-native-community/slider types */}
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={50}
          step={1}
          value={radiusKm}
          onValueChange={setRadiusKm}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="#E2E8F0"
        />
        <Text style={styles.info}>
          You'll be visible to clients within {radiusKm} km of the pin.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Next: ID Verification</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  map: {
    flex: 1,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  label: {
    ...typography.subheading,
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  info: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.subheading,
    color: colors.surface,
  },
});
