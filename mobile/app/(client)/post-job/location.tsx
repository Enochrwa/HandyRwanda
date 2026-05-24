import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { colors, typography, spacing, radius } from '../../../src/theme';

export default function JobLocation() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [region, setRegion] = useState({
    latitude: -1.9441,
    longitude: 30.0619,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [marker, setMarker] = useState({ latitude: -1.9441, longitude: 30.0619 });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setRegion({
        ...region,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setMarker({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    })();
  }, []);

  const handleNext = () => {
    router.push({
      pathname: '/(client)/post-job/confirm',
      params: { ...params, latitude: marker.latitude, longitude: marker.longitude },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Where is the job?</Text>
        <Text style={styles.subtitle}>Drop a pin at the job location</Text>
      </View>

      {/* @ts-ignore */}
      <MapView
        style={styles.map}
        region={region}
        onPress={(e: any) => setMarker(e.nativeEvent.coordinate)}
      >
        {/* @ts-ignore */}
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {/* @ts-ignore */}
        <Marker coordinate={marker} />
      </MapView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary },
  map: { flex: 1 },
  footer: { padding: spacing.lg, backgroundColor: colors.surface },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonText: { ...typography.subheading, color: colors.surface },
});
