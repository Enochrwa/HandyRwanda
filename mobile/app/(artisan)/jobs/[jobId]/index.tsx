// File: mobile/app/(artisan)/jobs/[jobId]/index.tsx
import { ArrowRight } from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../../src/services/api';

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
  recurring: 'Recurring',
  emergency: 'Emergency fix',
};

export default function JobDetailBid() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const qc = useQueryClient();
  const [bidPrice, setBidPrice] = useState('');
  const [message, setMessage] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [proposedStartTime, setProposedStartTime] = useState('');

  const { data: detail, isLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
  });

  const job = detail?.job;
  const priceGuidance = detail?.price_guidance;
  const alreadyBid = detail?.already_bid;

  const submitBid = useMutation({
    mutationFn: () =>
      api.post(`/bids/jobs/${jobId}`, {
        proposed_price: parseInt(bidPrice, 10),
        message: message.trim() || undefined,
        estimated_duration_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        proposed_start_time: proposedStartTime || undefined,
      }),
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: '🎉 Bid submitted!',
        text2: "You'll be notified if the client accepts.",
      });
      qc.invalidateQueries({ queryKey: ['open-jobs'] });
      qc.invalidateQueries({ queryKey: ['my-bids'] });
      router.back();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed to submit bid',
        text2: typeof msg === 'string' ? msg : 'Try again.',
      });
    },
  });

  const handleBid = () => {
    const price = parseInt(bidPrice, 10);
    if (!bidPrice || isNaN(price) || price < 500) {
      Toast.show({ type: 'error', text1: 'Invalid price', text2: 'Enter at least 500 RWF' });
      return;
    }
    submitBid.mutate();
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Text className="text-xl font-bold text-center">Job not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-primary px-6 py-3 rounded-2xl">
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="pt-14 pb-4 px-5 bg-card border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-primary font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-extrabold leading-tight">{job.title}</Text>
        <View className="flex-row flex-wrap gap-2 mt-2">
          {job.category?.name_en && (
            <View className="bg-primary/10 self-start px-2.5 py-1 rounded-full">
              <Text className="text-primary text-xs font-bold">
                {job.category.icon_emoji} {job.category.name_en}
              </Text>
            </View>
          )}
          {job.job_type && (
            <View className="bg-muted px-2.5 py-1 rounded-full">
              <Text className="text-muted-foreground text-xs font-semibold">
                {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
              </Text>
            </View>
          )}
          {job.urgency && job.urgency !== 'flexible' && (
            <View className={`px-2.5 py-1 rounded-full ${job.urgency === 'urgent' ? 'bg-destructive/10' : 'bg-accent/10'}`}>
              <Text className={`text-xs font-bold ${job.urgency === 'urgent' ? 'text-destructive' : 'text-accent'}`}>
                {URGENCY_LABELS[job.urgency]}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Job details card */}
        <View className="bg-card rounded-3xl border border-border p-5 mb-4">
          <Text className="text-sm text-foreground leading-6">{job.description}</Text>

          <View className="flex-row flex-wrap gap-4 mt-4 pt-4 border-t border-border">
            {job.budget && (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">
                  Client Budget
                </Text>
                <Text className="font-bold text-foreground">
                  {formatRWF(job.budget)} {job.budget_max ? `– ${formatRWF(job.budget_max)}` : ''} RWF
                </Text>
              </View>
            )}
            {job.location_label && (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">
                  Location
                </Text>
                <Text className="font-bold text-foreground">{job.location_label}</Text>
              </View>
            )}
            {job.scheduled_time && (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">
                  Preferred Time
                </Text>
                <Text className="font-bold text-foreground">
                  {new Date(job.scheduled_time).toLocaleDateString('en-RW', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            {job.bid_count !== undefined && (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">
                  Bids so far
                </Text>
                <Text className="font-bold text-foreground">{job.bid_count}</Text>
              </View>
            )}
          </View>

          {job.special_requirements && (
            <View className="mt-4 pt-4 border-t border-border">
              <Text className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Special Requirements
              </Text>
              <Text className="text-sm text-foreground">{job.special_requirements}</Text>
            </View>
          )}

          {job.is_remote_possible && (
            <View className="mt-3 bg-blue-50 rounded-xl px-3 py-2">
              <Text className="text-xs text-blue-700 font-semibold">
                ✅ Remote / phone consultation is possible
              </Text>
            </View>
          )}
        </View>

        {/* Price guidance */}
        {priceGuidance && (
          <View className="bg-accent/5 border border-accent/20 rounded-2xl p-4 mb-4">
            <Text className="text-xs font-bold text-accent mb-2">
              💰 Market Price Guide ({priceGuidance.district})
            </Text>
            <View className="flex-row gap-4">
              <View>
                <Text className="text-[10px] text-muted-foreground">Low</Text>
                <Text className="font-bold text-sm">{formatRWF(priceGuidance.min)} RWF</Text>
              </View>
              <View>
                <Text className="text-[10px] text-muted-foreground">Typical</Text>
                <Text className="font-bold text-sm text-accent">
                  {formatRWF(priceGuidance.median)} RWF
                </Text>
              </View>
              <View>
                <Text className="text-[10px] text-muted-foreground">High</Text>
                <Text className="font-bold text-sm">{formatRWF(priceGuidance.max)} RWF</Text>
              </View>
            </View>
            {priceGuidance.sample_size > 0 ? (
              <Text className="text-[10px] text-muted-foreground mt-1.5">
                Based on {priceGuidance.sample_size} completed jobs in this area
              </Text>
            ) : (
              <Text className="text-[10px] text-muted-foreground mt-1.5">
                Estimated — not enough local data yet
              </Text>
            )}
          </View>
        )}

        {/* Job photos */}
        {((job.images ?? job.photos_urls) as string[] | undefined)?.length ? (
          <View className="mb-4">
            <Text className="font-bold mb-2 text-sm">Client Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {((job.images ?? job.photos_urls) as string[]).map((url: string, i: number) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  className="w-36 h-36 rounded-2xl mr-3 bg-muted"
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Already bid notice */}
        {alreadyBid && (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
            <Text className="text-green-800 font-bold text-sm">
              ✅ You've already submitted a bid for this job
            </Text>
            <Text className="text-green-600 text-xs mt-1">
              You'll be notified if the client accepts your bid.
            </Text>
          </View>
        )}

        {/* Bid form */}
        {!alreadyBid && (
          <View className="bg-card rounded-3xl border border-border p-5 mb-8">
            <Text className="text-base font-extrabold mb-4">Submit Your Bid</Text>

            <View className="mb-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Your Price (RWF) *
              </Text>
              <TextInput
                value={bidPrice}
                onChangeText={setBidPrice}
                placeholder={
                  job.budget
                    ? `Client budget: ${formatRWF(job.budget)}${job.budget_max ? ` – ${formatRWF(job.budget_max)}` : ''} RWF`
                    : 'Enter your price in RWF'
                }
                keyboardType="number-pad"
                className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
              />
            </View>

            <View className="mb-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Estimated Duration (hours) — optional
              </Text>
              <TextInput
                value={estimatedHours}
                onChangeText={setEstimatedHours}
                placeholder="e.g. 2.5 hours"
                keyboardType="decimal-pad"
                className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
              />
            </View>

            <View className="mb-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Message to Client (optional)
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Why are you the right person? Share your experience, approach, and any questions for the client."
                multiline
                numberOfLines={4}
                className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
                style={{ textAlignVertical: 'top', minHeight: 100 }}
                maxLength={500}
              />
              <Text className="text-[10px] text-muted-foreground text-right mt-1">
                {message.length}/500
              </Text>
            </View>
          </View>
        )}

        {/* Bottom padding */}
        {alreadyBid && <View className="h-8" />}
      </ScrollView>

      {!alreadyBid && (
        <View className="px-5 pb-8 pt-3 bg-card border-t border-border">
          <TouchableOpacity
            onPress={handleBid}
            disabled={submitBid.isPending || !bidPrice}
            accessibilityLabel="Submit bid"
            className={`bg-accent rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
              !bidPrice || submitBid.isPending ? 'opacity-50' : ''
            }`}
          >
            {submitBid.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text className="text-white font-extrabold text-base">Send Bid</Text>
                <ArrowRight size={18} color="white" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
