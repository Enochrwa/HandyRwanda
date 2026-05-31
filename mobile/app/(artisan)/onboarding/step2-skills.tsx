// File: mobile/app/(artisan)/onboarding/step2-skills.tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

interface Category {
  id: string;
  name_en: string;
  name_rw?: string;
  icon_emoji?: string;
}

export default function SkillsStep() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/artisans/categories').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/artisans/skills', ids),
    onSuccess: () => router.push('/(artisan)/onboarding/step3-location'),
    onError: (err: any) => {
      const msg = err?.response?.data?.detail;
      Toast.show({ type: 'error', text1: 'Failed to save skills', text2: typeof msg === 'string' ? msg : 'Try again' });
    },
  });

  const toggleSkill = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="pt-14 pb-5 px-5 bg-primary">
        <Text className="text-white text-xl font-extrabold">Your Skills</Text>
        <Text className="text-white/80 text-sm mt-0.5">Step 2 of 4 — Select all that apply</Text>
        <View className="flex-row mt-3 gap-1">
          {[1, 2, 3, 4].map((s) => (
            <View key={s} className={`h-1.5 flex-1 rounded-full ${s <= 2 ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
          {selected.length > 0 && (
            <View className="mb-4 bg-primary/5 border border-primary/20 rounded-2xl p-3">
              <Text className="text-xs font-bold text-primary">
                {selected.length} skill{selected.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          <View className="flex-row flex-wrap gap-3 pb-6">
            {categories.map((cat: Category) => {
              const isSelected = selected.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  accessibilityLabel={`${isSelected ? 'Deselect' : 'Select'} ${cat.name_en}`}
                  onPress={() => toggleSkill(cat.id)}
                  className={`w-[47%] aspect-square rounded-3xl border-2 items-center justify-center p-3 relative ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                >
                  <Text style={{ fontSize: 34 }} className="mb-2">
                    {cat.icon_emoji ?? '🛠️'}
                  </Text>
                  <Text className={`text-xs font-bold text-center ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {cat.name_en}
                  </Text>
                  {cat.name_rw && (
                    <Text className="text-[10px] text-muted-foreground text-center mt-0.5">
                      {cat.name_rw}
                    </Text>
                  )}
                  {isSelected && (
                    <View className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Text className="text-white text-[10px] font-bold">✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <View className="px-5 pb-8 pt-3 bg-card border-t border-border">
        <TouchableOpacity
          onPress={() => saveMutation.mutate(selected)}
          disabled={selected.length === 0 || saveMutation.isPending}
          accessibilityLabel="Continue to set service area"
          className={`bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2 ${(selected.length === 0 || saveMutation.isPending) ? 'opacity-50' : ''}`}
        >
          {saveMutation.isPending
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-extrabold text-base">
                Continue → {selected.length > 0 ? `(${selected.length} selected)` : ''}
              </Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
