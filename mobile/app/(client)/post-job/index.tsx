import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radius } from '../../../src/theme';
import api from '../../../services/api';

export default function PostJobCategory() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/artisans/categories').then(res => {
      setCategories(res.data);
      setLoading(false);
    });
  }, []);

  const handleSelect = (catId: string) => {
    router.push({
      pathname: '/(client)/post-job/details',
      params: { categoryId: catId },
    });
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What do you need help with?</Text>
      <Text style={styles.subtitle}>Select a category to start your job post</Text>

      <View style={styles.grid}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={styles.card}
            onPress={() => handleSelect(cat.id)}
          >
            <Text style={styles.icon}>{cat.icon_emoji || '🛠️'}</Text>
            <Text style={styles.catName}>{cat.name_en}</Text>
          </TouchableOpacity>
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
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  catName: {
    ...typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});
