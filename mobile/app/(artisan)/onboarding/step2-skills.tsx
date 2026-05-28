import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import api from '../../../src/services/api';
import { colors, typography, spacing, radius } from '../../../src/theme';

interface Category {
  id: string;
  name_en: string;
  icon_emoji?: string;
}

export default function SkillsStep() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/artisans/categories').then((res) => {
      setCategories(res.data);
      setLoading(false);
    });
  }, []);

  const toggleSkill = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const handleNext = async () => {
    try {
      await api.post('/artisans/skills', selected);
      router.push('/(artisan)/onboarding/step3-location');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>What are your skills?</Text>
      <Text style={styles.subtitle}>Step 2 of 4: Select Service Categories</Text>

      <View style={styles.grid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.card, selected.includes(cat.id) && styles.activeCard]}
            onPress={() => toggleSkill(cat.id)}
          >
            <Text style={styles.icon}>{cat.icon_emoji || '🛠️'}</Text>
            <Text style={styles.catName}>{cat.name_en}</Text>
            {selected.includes(cat.id) && <View style={styles.check} />}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, selected.length === 0 && styles.disabledButton]}
        onPress={handleNext}
        disabled={selected.length === 0}
      >
        <Text style={styles.buttonText}>Next: Set Service Area</Text>
      </TouchableOpacity>
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
  activeCard: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDF4',
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
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.subheading,
    color: colors.surface,
  },
});
