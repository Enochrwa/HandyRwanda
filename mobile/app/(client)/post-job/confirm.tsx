// File: mobile/app/(client)/post-job/confirm.tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

const URGENCY_LABELS: Record<string, string> = {
  flexible: '📅 Flexible',
  this_week: '🗓️ This Week',
  tomorrow: '⏰ Tomorrow',
  today: '🔥 Today',
  urgent: '🚨 Urgent!',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  one_time: 'One-time job',
  recurring: 'Recurring work',
  emergency: 'Emergency fix',
};

export default function ConfirmJob() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [loading, setLoading] = useState(false);

  const budget = params.budget ? parseInt(params.budget, 10) : null;
  const budgetMax = params.budgetMax ? parseInt(params.budgetMax, 10) : null;

  const budgetDisplay = budget
    ? budgetMax
      ? `${formatRWF(budget)} – ${formatRWF(budgetMax)} RWF`
      : `${formatRWF(budget)} RWF`
    : 'Open to bids';

  const scheduledTimeDisplay = params.scheduledTime
    ? new Date(params.scheduledTime).toLocaleString('en-RW', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not specified';

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const jobData: Record<string, unknown> = {
        category_id: params.categoryId,
        title: params.title,
        description: params.description,
        latitude: parseFloat(params.latitude ?? '-1.9441'),
        longitude: parseFloat(params.longitude ?? '30.0619'),
        location_label: params.locationLabel ?? 'Kigali',
        job_type: params.jobType ?? 'one_time',
        urgency: params.urgency ?? 'flexible',
        is_remote_possible: params.isRemotePossible === '1',
        ...(budget && { budget }),
        ...(budgetMax && { budget_max: budgetMax }),
        ...(params.specialRequirements?.trim() && { special_requirements: params.specialRequirements }),
        ...(params.scheduledTime && { scheduled_time: params.scheduledTime }),
      };

      const photos = JSON.parse(params.photos ?? '[]') as string[];
      if (photos.length > 0) {
        jobData.photos_base64 = photos;
      }

      await api.post('/jobs', jobData);
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

  const rows = [
    { label: 'Title', value: params.title },
    { label: 'Job Type', value: JOB_TYPE_LABELS[params.jobType ?? 'one_time'] ?? params.jobType },
    { label: 'Urgency', value: URGENCY_LABELS[params.urgency ?? 'flexible'] ?? params.urgency },
    { label: 'Scheduled', value: scheduledTimeDisplay },
    { label: 'Budget', value: budgetDisplay },
    {
      label: 'Location',
      value: params.locationLabel ?? `${parseFloat(params.latitude ?? '0').toFixed(4)}, ${parseFloat(params.longitude ?? '0').toFixed(4)}`,
    },
    ...(params.isRemotePossible === '1' ? [{ label: 'Remote', value: '✅ Remote possible' }] : []),
  ];

  return (
    <View className="flex-1 bg-background">
      <View className="pt-14 pb-4 px-5 bg-card border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-primary font-semibold">← Back</Text>
        </TouchableOpacity>
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
            <View
              key={label}
              className={`px-5 py-4 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}
            >
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                {label}
              </Text>
              <Text className="font-semibold text-foreground text-sm">{value}</Text>
            </View>
          ))}
        </View>

        {params.description ? (
          <View className="bg-card rounded-3xl border border-border p-5 mb-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Description
            </Text>
            <Text className="text-foreground text-sm leading-5">{params.description}</Text>
          </View>
        ) : null}

        {params.specialRequirements?.trim() ? (
          <View className="bg-card rounded-3xl border border-border p-5 mb-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Special Requirements
            </Text>
            <Text className="text-foreground text-sm leading-5">{params.specialRequirements}</Text>
          </View>
        ) : null}

        <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-8">
          <Text className="text-xs font-bold text-primary mb-1">📋 What happens next?</Text>
          <Text className="text-xs text-muted-foreground leading-5">
            Verified artisans with matching skills will see your job and submit bids. You'll receive
            push notifications and can compare bids before accepting the best one.
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
          className={`flex-[2] bg-accent rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
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
