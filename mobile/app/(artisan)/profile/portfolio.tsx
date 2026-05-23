import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radius } from '../../../src/theme';
import api from '../../../services/api';

export default function PortfolioScreen() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = async () => {
    try {
      const res = await api.get('/artisans/profile/me');
      // In a real app, portfolio might be a separate field or relation
      // For now, let's assume we have an endpoint for it or it's in profile
      const userRes = await api.get(`/${res.data.user_id}/profile`);
      setPhotos(userRes.data.portfolio);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const addPhoto = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      try {
        await api.post('/artisans/portfolio', {
          photo_base64: result.assets[0].base64,
          job_type: 'Past Work',
        });
        fetchPortfolio();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const deletePhoto = async (id: string) => {
    try {
      await api.delete(`/artisans/portfolio/${id}`);
      fetchPortfolio();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <Text style={styles.subtitle}>{photos.length}/12 photos</Text>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.addBox} onPress={addPhoto} disabled={photos.length >= 12}>
          <Text style={styles.addIcon}>+</Text>
          <Text style={styles.addText}>Add Work</Text>
        </TouchableOpacity>

        {photos.map(photo => (
          <View key={photo.id} style={styles.item}>
            <Image source={{ uri: photo.image_url }} style={styles.image} />
            <TouchableOpacity style={styles.delete} onPress={() => deletePhoto(photo.id)}>
              <Text style={styles.deleteText}>×</Text>
            </TouchableOpacity>
            {photo.job_type && (
              <View style={styles.label}>
                <Text style={styles.labelText}>{photo.job_type}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.bg,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'between',
    alignItems: 'baseline',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  addBox: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    fontSize: 32,
    color: colors.primary,
  },
  addText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  item: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  delete: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 4,
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
});
