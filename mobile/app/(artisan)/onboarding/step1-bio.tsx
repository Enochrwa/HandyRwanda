import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radius } from '../../../src/theme';
import api from '../../../services/api';

export default function BioStep() {
  const router = useRouter();
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState<string[]>(['rw']);

  const handleNext = async () => {
    try {
      await api.post('/artisans/profile', {
        bio,
        years_experience: parseInt(experience) || 0,
        spoken_languages: languages.join(','),
      });
      router.push('/(artisan)/onboarding/step2-skills');
    } catch (error) {
      console.error(error);
    }
  };

  const toggleLang = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter(l => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tell us about yourself</Text>
      <Text style={styles.subtitle}>Step 1 of 4: Profile Bio</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bio (Max 250 chars)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your skills and experience..."
          multiline
          maxLength={250}
          value={bio}
          onChangeText={setBio}
        />
        <Text style={styles.counter}>{bio.length}/250</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Years of Experience</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5"
          keyboardType="number-pad"
          value={experience}
          onChangeText={setExperience}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Spoken Languages</Text>
        <View style={styles.chipGroup}>
          {[
            { id: 'rw', label: 'Kinyarwanda' },
            { id: 'en', label: 'English' },
            { id: 'fr', label: 'Français' },
            { id: 'sw', label: 'Swahili' },
          ].map(lang => (
            <TouchableOpacity
              key={lang.id}
              style={[styles.chip, languages.includes(lang.id) && styles.activeChip]}
              onPress={() => toggleLang(lang.id)}
            >
              <Text style={[styles.chipText, languages.includes(lang.id) && styles.activeChipText]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Next: Select Skills</Text>
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
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...typography.body,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  counter: {
    textAlign: 'right',
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.text,
  },
  activeChipText: {
    color: colors.surface,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonText: {
    ...typography.subheading,
    color: colors.surface,
  },
});
