// File: mobile/app/(client)/post-job/confirm.tsx
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

const URGENCY_LABELS: Record<string, string> = {
  flexible: '📅 Flexible (within 2 weeks)',
  this_week: '🗓️ This Week (within 7 days)',
  tomorrow: '⏰ Tomorrow (within 24h)',
  today: '🔥 Today',
  urgent: '🚨 Urgent (within 2 hours)',
};

export default function ConfirmJob() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<Record<string, string>>();
  const [loading, setLoading] = useState(false);

  // Fetch the full category list (already cached by React Query from the previous screen)
  // and derive the selected category from it — avoids a non-existent /categories/:id endpoint.
  const { data: allCategories = [] } = useQuery<
    { id: string; name_en: string; icon_emoji?: string }[]
  >({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });
  const category = allCategories.find((c) => c.id === params.categoryId) ?? null;

  const budget = params.budget ? parseInt(params.budget, 10) : null;
  const photos = JSON.parse(params.photos ?? '[]') as string[];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const jobData: Record<string, unknown> = {
        category_id: params.categoryId,
        title: params.title,
        description: params.description,
        additional_notes: params.additionalNotes || undefined,
        latitude: parseFloat(params.latitude ?? '-1.9441'),
        longitude: parseFloat(params.longitude ?? '30.0619'),
        location_label: params.locationLabel ?? 'Custom Location',
        urgency: params.urgency ?? 'flexible',
        budget_negotiable: params.budgetNegotiable === '1',
        ...(params.scheduledTime ? { scheduled_time: params.scheduledTime } : {}),
        ...(budget ? { budget } : {}),
        ...(photos.length > 0 ? { photos_base64: photos } : {}),
      };

      await api.post('/jobs', jobData);
      await qc.invalidateQueries({ queryKey: ['my-jobs'] });
      Toast.show({
        type: 'success',
        text1: '🎉 Job Posted!',
        text2: 'Artisans will start bidding shortly.',
      });
      router.replace('/(tabs)/search');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed to post job',
        text2: typeof msg === 'string' ? msg : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const summaryRows = [
    {
      label: 'Service Category',
      value: category?.name_en ?? 'Loading...',
      icon: category?.icon_emoji ?? '🛠️',
    },
    { label: 'Title', value: params.title },
    { label: 'Urgency', value: URGENCY_LABELS[params.urgency ?? 'flexible'] },
    {
      label: 'Budget',
      value: budget
        ? `${formatRWF(budget)} RWF${params.budgetNegotiable === '1' ? ' (negotiable)' : ''}`
        : 'Open to bids',
    },
    {
      label: 'Location',
      value:
        params.locationLabel ??
        `${parseFloat(params.latitude ?? '0').toFixed(4)}, ${parseFloat(params.longitude ?? '0').toFixed(4)}`,
    },
    ...(params.scheduledTime
      ? [
          {
            label: 'Scheduled',
            value: new Date(params.scheduledTime).toLocaleString('en-RW', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]
      : []),
    {
      label: 'Photos',
      value:
        photos.length > 0
          ? `${photos.length} photo${photos.length > 1 ? 's' : ''} attached`
          : 'None',
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <View className="pt-14 pb-4 px-5 bg-card border-b border-border">
        <Text className="text-xl font-extrabold">Review & Post</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          Step 3 of 3 — Confirm your job details
        </Text>
        <View className="flex-row mt-2">
          {[1, 2, 3].map((s) => (
            <View key={s} className="h-1 flex-1 rounded-full mr-1 bg-primary" />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        {/* Summary table */}
        <View className="bg-card rounded-3xl border border-border overflow-hidden mb-5">
          {summaryRows.map(({ label, value, icon }, i) => (
            <View
              key={label}
              className={`px-5 py-4 ${i < summaryRows.length - 1 ? 'border-b border-border' : ''}`}
            >
              <View className="flex-row items-center gap-2 mb-0.5">
                {icon && <Text style={{ fontSize: 16 }}>{icon}</Text>}
                <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {label}
                </Text>
              </View>
              <Text className="font-semibold text-foreground text-sm">{value}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        {params.description ? (
          <View className="bg-card rounded-3xl border border-border p-5 mb-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Description
            </Text>
            <Text className="text-foreground text-sm leading-5">{params.description}</Text>
          </View>
        ) : null}

        {/* Additional Notes */}
        {params.additionalNotes ? (
          <View className="bg-card rounded-3xl border border-border p-5 mb-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Additional Notes
            </Text>
            <Text className="text-muted-foreground text-sm leading-5">
              {params.additionalNotes}
            </Text>
          </View>
        ) : null}

        <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-8">
          <Text className="text-xs font-bold text-primary mb-1">📋 What happens next?</Text>
          <Text className="text-xs text-muted-foreground leading-5">
            Verified artisans matching your job category will see this posting and submit
            competitive bids. You can compare their profiles, ratings, and prices before accepting
            any bid.
          </Text>
        </View>
      </ScrollView>

      <View className="px-5 pb-8 pt-3 bg-card border-t border-border flex-row gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="flex-1 bg-muted rounded-2xl py-4 items-center border border-border"
        >
          <Text className="font-bold text-foreground">← Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          accessibilityLabel="Post job"
          className={`flex-[2] bg-primary rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-extrabold text-base">Post Job — Free ✓</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
