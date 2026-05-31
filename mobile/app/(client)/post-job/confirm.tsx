// File: mobile/app/(client)/post-job/confirm.tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

export default function ConfirmJob() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [loading, setLoading] = useState(false);

  const budget = params.budget ? parseInt(params.budget, 10) : null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const dateOffset: Record<string, number> = { Today: 0, Tomorrow: 1, 'This week': 4, Flexible: 7 };
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (dateOffset[params.when ?? 'Tomorrow'] ?? 1));

      const jobData: Record<string, unknown> = {
        category_id: params.categoryId,
        title: params.title,
        description: params.description,
        latitude: parseFloat(params.latitude ?? '-1.9441'),
        longitude: parseFloat(params.longitude ?? '30.0619'),
        location_label: params.locationLabel ?? 'Custom Location',
        scheduled_time: scheduledDate.toISOString(),
        ...(budget && { budget }),
      };

      const photos = JSON.parse(params.photos ?? '[]') as string[];
      if (photos.length > 0) {
        jobData.photos_base64 = photos;
      }

      await api.post('/jobs', jobData);
      Toast.show({ type: 'success', text1: '🎉 Job Posted!', text2: 'Artisans will start bidding shortly.' });
      router.replace('/(tabs)/search');
    } catch (error: any) {
      const msg = error?.response?.data?.detail;
      Toast.show({ type: 'error', text1: 'Failed to post job', text2: typeof msg === 'string' ? msg : 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const rows = [
    { label: 'Title', value: params.title },
    { label: 'When', value: params.when ?? 'Flexible' },
    { label: 'Budget', value: budget ? `${formatRWF(budget)} RWF` : 'Open to bids' },
    { label: 'Location', value: params.locationLabel ?? `${parseFloat(params.latitude ?? '0').toFixed(4)}, ${parseFloat(params.longitude ?? '0').toFixed(4)}` },
  ];

  return (
    <View className="flex-1 bg-background">
      <View className="pt-14 pb-4 px-5 bg-card border-b border-border">
        <Text className="text-xl font-extrabold">Review & Post</Text>
        <View className="flex-row mt-2">
          {[1, 2, 3].map((s) => (
            <View key={s} className="h-1 flex-1 rounded-full mr-1 bg-primary" />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        <View className="bg-card rounded-3xl border border-border overflow-hidden mb-5">
          {rows.map(({ label, value }, i) => (
            <View key={label} className={`px-5 py-4 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}>
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">{label}</Text>
              <Text className="font-semibold text-foreground text-sm">{value}</Text>
            </View>
          ))}
        </View>

        {params.description ? (
          <View className="bg-card rounded-3xl border border-border p-5 mb-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Description</Text>
            <Text className="text-foreground text-sm leading-5">{params.description}</Text>
          </View>
        ) : null}

        <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-8">
          <Text className="text-xs font-bold text-primary mb-1">📋 What happens next?</Text>
          <Text className="text-xs text-muted-foreground leading-5">
            Verified artisans nearby will see your job and submit bids. You'll receive notifications and can compare them before accepting.
          </Text>
        </View>
      </ScrollView>

      <View className="px-5 pb-8 pt-3 bg-card border-t border-border flex-row gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="flex-1 bg-muted rounded-2xl py-4 items-center border border-border"
        >
          <Text className="font-bold text-foreground">← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          accessibilityLabel="Post job"
          className={`flex-[2] bg-accent rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-extrabold text-base">Post Job — Free ✓</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
