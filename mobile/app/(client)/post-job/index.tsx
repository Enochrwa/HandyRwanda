// File: mobile/app/(client)/post-job/index.tsx
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';

import api from '../../../src/services/api';

export default function PostJobCategory() {
  const router = useRouter();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/artisans/categories').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="pt-14 pb-4 px-5 bg-primary">
        <Text className="text-white text-2xl font-extrabold">Post a Job</Text>
        <Text className="text-white/80 text-sm mt-1">What do you need help with?</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap gap-3 pb-8">
          {categories.map((cat: { id: string; name_en: string; icon_emoji?: string }) => (
            <TouchableOpacity
              key={cat.id}
              accessibilityLabel={`Post job for ${cat.name_en}`}
              onPress={() => router.push({ pathname: '/(client)/post-job/details', params: { categoryId: cat.id } })}
              className="w-[47%] aspect-square bg-card rounded-3xl border border-border items-center justify-center p-4"
            >
              <Text style={{ fontSize: 36 }} className="mb-2">{cat.icon_emoji ?? '🛠️'}</Text>
              <Text className="font-bold text-center text-foreground text-sm">{cat.name_en}</Text>
            </TouchableOpacity>
          ))}

          {categories.length === 0 && (
            <View className="w-full py-12 items-center">
              <Text className="text-muted-foreground">No categories available yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
