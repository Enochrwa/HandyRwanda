import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import api from '../../../src/services/api';
import { colors, typography, spacing, radius } from '../../../src/theme';

export default function ConfirmJob() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/jobs', {
        category_id: params.categoryId,
        title: params.title,
        description: params.description,
        latitude: parseFloat(params.latitude),
        longitude: parseFloat(params.longitude),
        location_label: 'Custom Location',
        budget: params.budget ? parseInt(params.budget as string, 10) : null,
        photos_base64: JSON.parse(params.photos || '[]'),
      });
      Alert.alert('Success', 'Job posted successfully!', [
        { text: 'OK', onPress: () => router.replace('/(client)/home') },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Review & Post</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Title</Text>
        <Text style={styles.value}>{params.title}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Description</Text>
        <Text style={styles.value}>{params.description}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Budget</Text>
        <Text style={styles.value}>{params.budget ? `${params.budget} RWF` : 'Not specified'}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Post Job (Free)</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.bg, flexGrow: 1 },
  title: { ...typography.heading, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  value: { ...typography.body, fontWeight: '600', marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: spacing.md },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonText: { ...typography.subheading, color: colors.surface },
});
