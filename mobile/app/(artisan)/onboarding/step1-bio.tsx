// File: mobile/app/(artisan)/onboarding/step1-bio.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

const LANGUAGES = [
  { code: 'rw', label: '🇷🇼 Kinyarwanda' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'sw', label: '🇰🇪 Swahili' },
];

export default function BioStep() {
  const router = useRouter();
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [languages, setLanguages] = useState<string[]>(['rw']);
  const [loading, setLoading] = useState(false);

  const toggleLang = (code: string) => {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const handleNext = async () => {
    if (bio.trim().length < 20) {
      Toast.show({ type: 'error', text1: 'Bio too short', text2: 'Write at least 20 characters' });
      return;
    }
    if (languages.length === 0) {
      Toast.show({ type: 'error', text1: 'Select a language', text2: 'Pick at least one language you speak' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/artisans/profile', {
        bio: bio.trim(),
        years_experience: parseInt(experience, 10) || 0,
        spoken_languages: languages.join(','),
        ...(hourlyRate && { hourly_rate: parseInt(hourlyRate, 10) }),
      });
      router.push('/(artisan)/onboarding/step2-skills');
    } catch (error: any) {
      const msg = error?.response?.data?.detail;
      Toast.show({ type: 'error', text1: 'Error', text2: typeof msg === 'string' ? msg : 'Failed to save. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <View className="pt-14 pb-4 px-5 bg-primary">
        <Text className="text-white text-xl font-extrabold">Tell us about yourself</Text>
        <Text className="text-white/80 text-sm mt-0.5">Step 1 of 4</Text>
        <View className="flex-row mt-3 gap-1">
          {[1, 2, 3, 4].map((s) => (
            <View key={s} className={`h-1.5 flex-1 rounded-full ${s <= 1 ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Bio */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Bio * <Text className="normal-case font-normal">({bio.length}/250)</Text>
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Describe your skills, experience, and what makes you stand out…"
            multiline
            maxLength={250}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            style={{ textAlignVertical: 'top', minHeight: 110 }}
            autoCapitalize="sentences"
          />
        </View>

        {/* Experience */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Years of Experience</Text>
          <TextInput
            value={experience}
            onChangeText={setExperience}
            placeholder="e.g. 5"
            keyboardType="number-pad"
            maxLength={2}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
          />
        </View>

        {/* Hourly Rate */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Hourly Rate (RWF) — optional</Text>
          <TextInput
            value={hourlyRate}
            onChangeText={setHourlyRate}
            placeholder="e.g. 5000"
            keyboardType="number-pad"
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
          />
          <Text className="text-[10px] text-muted-foreground mt-1">
            Set a starting rate. You can always negotiate per job.
          </Text>
        </View>

        {/* Languages */}
        <View className="mb-8">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Languages Spoken *</Text>
          <View className="flex-row flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                onPress={() => toggleLang(l.code)}
                accessibilityLabel={l.label}
                className={`px-4 py-2.5 rounded-xl border-2 ${languages.includes(l.code) ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              >
                <Text className={`text-sm font-semibold ${languages.includes(l.code) ? 'text-primary' : 'text-foreground'}`}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="px-5 pb-8 pt-3 bg-card border-t border-border">
        <TouchableOpacity
          onPress={handleNext}
          disabled={loading}
          accessibilityLabel="Continue to skills"
          className={`bg-primary rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-extrabold text-base">Continue →</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
