import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import api from '../../../services/api';
import { colors, typography, spacing, radius } from '../../../src/theme';

export default function ArtisanJobFeed() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/jobs/available').then((res) => {
      setJobs(res.data);
      setLoading(false);
    });
  }, []);

  const renderItem = ({ item }: { item: Record<string, unknown> }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/(artisan)/jobs/${item.id}`)}>
      <View style={styles.header}>
        <Text style={styles.jobTitle}>{item.title}</Text>
        <Text style={styles.distance}>{item.distance_km.toFixed(1)} km away</Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.budget}>{item.budget ? `${item.budget} RWF` : 'No budget'}</Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Jobs</Text>
      <FlatList
        data={jobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No jobs nearby right now.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { ...typography.heading, marginBottom: spacing.lg },
  list: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  jobTitle: { ...typography.subheading, color: colors.text, flex: 1 },
  distance: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  description: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  budget: { ...typography.caption, fontWeight: '700', color: colors.text },
  time: { ...typography.caption, color: colors.textSecondary },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: colors.textSecondary },
});
