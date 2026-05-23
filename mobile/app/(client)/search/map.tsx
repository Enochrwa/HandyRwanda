import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, typography, spacing, radius } from '../../../src/theme';
import api from '../../../services/api';
import { useRouter } from 'expo-router';

export default function ArtisanMapSearch() {
  const router = useRouter();
  const [region, setRegion] = useState<any>(null);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [selectedArtisan, setSelectedArtisan] = useState<any>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
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
        params: { latitude: lat, longitude: lng, radius_km: 10 }
      });
      setArtisans(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const onMarkerPress = (artisan: any) => {
    setSelectedArtisan(artisan);
    bottomSheetRef.current?.expand();
  };

  if (!region) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={(r) => fetchArtisans(r.latitude, r.longitude)}
      >
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
        {artisans.map(a => (
          <Marker
            key={a.id}
            coordinate={{ latitude: a.lat || region.latitude, longitude: a.lng || region.longitude }}
            onPress={() => onMarkerPress(a)}
          >
            <View style={styles.customMarker}>
              {a.avatar_url ? (
                <Image source={{ uri: a.avatar_url }} style={styles.markerImage} />
              ) : (
                <View style={styles.markerPlaceholder} />
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['30%']}
        enablePanDownToClose
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedArtisan && (
            <View>
              <View style={styles.sheetHeader}>
                <Image source={{ uri: selectedArtisan.avatar_url }} style={styles.sheetAvatar} />
                <View style={styles.sheetInfo}>
                  <Text style={styles.sheetName}>{selectedArtisan.full_name}</Text>
                  <Text style={styles.sheetStats}>⭐ {selectedArtisan.average_rating} • {selectedArtisan.distance_km.toFixed(1)} km</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => router.push(`/artisan/${selectedArtisan.id}`)}
              >
                <Text style={styles.profileButtonText}>View Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  customMarker: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.primary, backgroundColor: '#fff', overflow: 'hidden' },
  markerImage: { width: '100%', height: '100%' },
  markerPlaceholder: { flex: 1, backgroundColor: colors.primaryLight },
  sheetContent: { padding: spacing.lg },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  sheetAvatar: { width: 60, height: 60, borderRadius: 30, marginRight: spacing.md },
  sheetName: { ...typography.subheading, fontWeight: '700' },
  sheetStats: { ...typography.caption, color: colors.textSecondary },
  profileButton: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  profileButtonText: { ...typography.subheading, color: colors.surface },
});
