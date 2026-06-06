// File: mobile/app/(artisan)/onboarding/step1-bio.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

const LANGUAGES = [
  { code: 'rw', label: '🇷🇼 Kinyarwanda' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'sw', label: '🇰🇪 Swahili' },
];

/**
 * Extract a human-readable message from any Axios error.
 * Handles:
 *   - FastAPI HTTPException:  { detail: "string" }
 *   - Pydantic 422:           { detail: [{ msg: "...", loc: [...] }] }
 *   - Network errors:         error.message (e.g. "Network Error")
 */
function extractErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic validation error — join all field messages
    return detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc.slice(-1)[0] : '';
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join('\n');
  }

  // Network-level error (no response at all)
  if (!error?.response) {
    return `Network error — check that the server is reachable.\n(${error?.message ?? 'unknown'})`;
  }

  return 'Failed to save. Please try again.';
}

export default function BioStep() {
  const router = useRouter();
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [fixedRate, setFixedRate] = useState('');
  const [serviceRadius, setServiceRadius] = useState('10');
  const [languages, setLanguages] = useState<string[]>(['rw']);
  const [loading, setLoading] = useState(false);

  const toggleLang = (code: string) => {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  };

  const handleNext = async () => {
    // ── Client-side validation ───────────────────────────────────────────
    if (bio.trim().length < 20) {
      Toast.show({
        type: 'error',
        text1: 'Bio too short',
        text2: 'Write at least 20 characters.',
      });
      return;
    }
    if (languages.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Select a language',
        text2: 'Pick at least one language you speak.',
      });
      return;
    }

    const radius = parseInt(serviceRadius, 10);
    if (isNaN(radius) || radius < 1 || radius > 50) {
      Toast.show({
        type: 'error',
        text1: 'Invalid service radius',
        text2: 'Enter a value between 1 and 50 km.',
      });
      return;
    }

    // ── Build payload ────────────────────────────────────────────────────
    const payload: Record<string, any> = {
      bio: bio.trim(),
      years_experience: parseInt(experience, 10) || 0,
      spoken_languages: languages.join(','),
      service_radius_km: radius,
    };

    const parsedHourly = parseInt(hourlyRate, 10);
    if (!isNaN(parsedHourly) && parsedHourly > 0) {
      payload.hourly_rate = parsedHourly;
    }

    const parsedFixed = parseInt(fixedRate, 10);
    if (!isNaN(parsedFixed) && parsedFixed > 0) {
      payload.fixed_rate = parsedFixed;
    }

    setLoading(true);
    try {
      await api.post('/artisans/profile', payload);
      router.push('/(artisan)/onboarding/step2-skills');
    } catch (error: any) {
      const msg = extractErrorMessage(error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: msg,
        visibilityTime: 5000, // longer so multi-line messages are readable
      });
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
            <View
              key={s}
              className={`h-1.5 flex-1 rounded-full ${s <= 1 ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bio */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Bio *{' '}
            <Text className="normal-case font-normal">
              ({bio.length}/500{bio.length < 20 ? ` — need ${20 - bio.length} more` : ''})
            </Text>
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Describe your skills, experience, and what makes you stand out…"
            multiline
            maxLength={500}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            style={{ textAlignVertical: 'top', minHeight: 110 }}
            autoCapitalize="sentences"
          />
        </View>

        {/* Experience */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Years of Experience
          </Text>
          <TextInput
            value={experience}
            onChangeText={(v) => setExperience(v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 5"
            keyboardType="number-pad"
            maxLength={2}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
          />
        </View>

        {/* Hourly Rate */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Hourly Rate (RWF) — optional
          </Text>
          <TextInput
            value={hourlyRate}
            onChangeText={(v) => setHourlyRate(v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 5000"
            keyboardType="number-pad"
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
          />
          <Text className="text-[10px] text-muted-foreground mt-1">
            Set a starting rate. You can always negotiate per job.
          </Text>
        </View>

        {/* Fixed Rate */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Fixed Rate per Job (RWF) — optional
          </Text>
          <TextInput
            value={fixedRate}
            onChangeText={(v) => setFixedRate(v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 20000 per job"
            keyboardType="number-pad"
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
          />
          <Text className="text-[10px] text-muted-foreground mt-1">
            For jobs you charge per project, not per hour.
          </Text>
        </View>

        {/* Service Radius */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Service Radius (km)
          </Text>
          <TextInput
            value={serviceRadius}
            onChangeText={(v) => setServiceRadius(v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 10"
            keyboardType="number-pad"
            maxLength={2}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
          />
          <Text className="text-[10px] text-muted-foreground mt-1">
            How far are you willing to travel to a job? (1–50 km)
          </Text>
        </View>

        {/* Languages */}
        <View className="mb-8">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Languages Spoken *
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                onPress={() => toggleLang(l.code)}
                accessibilityLabel={l.label}
                className={`px-4 py-2.5 rounded-xl border-2 ${
                  languages.includes(l.code)
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    languages.includes(l.code) ? 'text-primary' : 'text-foreground'
                  }`}
                >
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
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-extrabold text-base">Continue →</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
