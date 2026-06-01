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
  urgent: '🚨 Urgent (2 hours)',
  today: '🔥 Today',
  tomorrow: '⏰ Tomorrow',
  this_week: '🗓️ This Week',
  flexible: '📅 Flexible',
};

export default function JobDetailBid() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const qc = useQueryClient();
  const [bidPrice, setBidPrice] = useState('');
  const [message, setMessage] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');

  const { data: jobResp, isLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
  });

  const job = jobResp?.job;
  const priceGuidance = jobResp?.price_guidance;
  const alreadyBid = jobResp?.already_bid;

  const submitBid = useMutation({
    mutationFn: () =>
      api.post(`/bids/jobs/${jobId}`, {
        proposed_price: parseInt(bidPrice, 10),
        message: message.trim() || undefined,
        cover_letter: coverLetter.trim() || undefined,
        estimated_duration_hours: estimatedHours ? parseInt(estimatedHours, 10) : undefined,
      }),
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: '🎉 Bid submitted!',
        text2: "You'll be notified if the client accepts.",
      });
      qc.invalidateQueries({ queryKey: ['available-jobs'] });
      router.back();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Try again.',
      });
    },
  });

  const handleBid = () => {
    const price = parseInt(bidPrice, 10);
    if (!bidPrice || isNaN(price) || price < 500) {
      Toast.show({
        type: 'error',
        text1: 'Invalid price',
        text2: 'Enter a price of at least 500 RWF',
      });
      return;
    }
    if (
      estimatedHours &&
      (parseInt(estimatedHours, 10) < 1 || parseInt(estimatedHours, 10) > 720)
    ) {
      Toast.show({ type: 'error', text1: 'Invalid duration', text2: '1 to 720 hours only' });
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
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary px-6 py-3 rounded-2xl"
        >
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
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="mb-3"
        >
          <Text className="text-primary font-semibold">← Back to Jobs</Text>
        </TouchableOpacity>
        <View className="flex-row flex-wrap gap-2 mb-1">
          {job.urgency && job.urgency !== 'flexible' && (
            <View className="bg-red-100 px-2.5 py-0.5 rounded-full self-start">
              <Text className="text-red-700 text-[11px] font-bold">
                {URGENCY_LABELS[job.urgency] ?? job.urgency}
              </Text>
            </View>
          )}
          {job.category?.name_en && (
            <View className="bg-primary/10 px-2.5 py-0.5 rounded-full self-start">
              <Text className="text-primary text-xs font-bold">
                {job.category.icon_emoji} {job.category.name_en}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-xl font-extrabold">{job.title}</Text>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Already bid banner */}
        {alreadyBid && (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
            <Text className="text-lg">✅</Text>
            <Text className="text-green-700 text-sm font-semibold">
              You have already submitted a bid on this job.
            </Text>
          </View>
        )}

        {/* Job info */}
        <View className="bg-card rounded-3xl border border-border p-5 mb-5">
          <Text className="text-sm text-foreground leading-6">{job.description}</Text>

          {job.additional_notes && (
            <View className="mt-3 pt-3 border-t border-border">
              <Text className="text-xs font-bold uppercase text-muted-foreground mb-1">
                Additional Notes
              </Text>
              <Text className="text-sm text-muted-foreground italic">{job.additional_notes}</Text>
            </View>
          )}

          <View className="flex-row flex-wrap gap-4 mt-4 pt-4 border-t border-border">
            {job.budget ? (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">
                  Budget
                </Text>
                <Text className="font-bold text-foreground">
                  {formatRWF(job.budget)} RWF
                  {job.budget_negotiable && (
                    <Text className="text-xs text-muted-foreground font-normal"> (negotiable)</Text>
                  )}
                </Text>
              </View>
            ) : (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">
                  Budget
                </Text>
                <Text className="font-semibold text-muted-foreground">Open to bids</Text>
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
                  Scheduled
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
        </View>

        {/* Price guidance */}
        {priceGuidance && priceGuidance.sample_size > 0 && (
          <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-5">
            <Text className="text-xs font-bold text-primary mb-2">
              💡 Market Price in {priceGuidance.district}
            </Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-[10px] text-muted-foreground">Minimum</Text>
                <Text className="font-bold text-sm">{formatRWF(priceGuidance.min)} RWF</Text>
              </View>
              <View className="items-center border-x border-primary/20 px-4">
                <Text className="text-[10px] text-muted-foreground">Typical</Text>
                <Text className="font-bold text-sm text-primary">
                  {formatRWF(priceGuidance.median)} RWF
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-[10px] text-muted-foreground">Maximum</Text>
                <Text className="font-bold text-sm">{formatRWF(priceGuidance.max)} RWF</Text>
              </View>
            </View>
            <Text className="text-[10px] text-muted-foreground mt-2 text-center">
              {priceGuidance.note}
            </Text>
          </View>
        )}

        {/* Job photos */}
        {((job.images ?? job.photos_urls) as string[] | undefined)?.length ? (
          <View className="mb-5">
            <Text className="font-bold mb-2">
              Client Photos ({(job.images ?? (job.photos_urls as string[])).length})
            </Text>
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

        {/* Bid form */}
        {!alreadyBid && (
          <View className="bg-card rounded-3xl border border-border p-5 mb-8">
            <Text className="text-base font-extrabold mb-1">Submit Your Bid</Text>
            <Text className="text-xs text-muted-foreground mb-4">
              Detailed bids get accepted more often. Explain your approach and why you're the right
              person.
            </Text>

            {/* Price */}
            <View className="mb-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Your Price (RWF) <Text className="text-destructive">*</Text>
              </Text>
              <TextInput
                value={bidPrice}
                onChangeText={setBidPrice}
                placeholder={
                  job.budget
                    ? `Client budget: ${formatRWF(job.budget)} RWF`
                    : 'Enter your price in RWF'
                }
                keyboardType="number-pad"
                className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
              />
            </View>

            {/* Duration */}
            <View className="mb-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Estimated Duration (hours){' '}
                <Text className="text-[10px] font-normal">(optional)</Text>
              </Text>
              <TextInput
                value={estimatedHours}
                onChangeText={setEstimatedHours}
                placeholder="e.g. 3 (how many hours you expect to take)"
                keyboardType="number-pad"
                className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
              />
            </View>

            {/* Approach */}
            <View className="mb-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Your Approach{' '}
                <Text className="text-[10px] font-normal">(optional but recommended)</Text>
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="How would you tackle this job? What tools or materials will you bring?"
                multiline
                numberOfLines={3}
                className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
                style={{ textAlignVertical: 'top', minHeight: 80 }}
                maxLength={500}
              />
              <Text className="text-[10px] text-muted-foreground text-right mt-1">
                {message.length}/500
              </Text>
            </View>

            {/* Cover Letter */}
            <View className="mb-2">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Why You? <Text className="text-[10px] font-normal">(optional)</Text>
              </Text>
              <TextInput
                value={coverLetter}
                onChangeText={setCoverLetter}
                placeholder="Years of experience with this type of work, similar completed jobs, certifications, tools you own..."
                multiline
                numberOfLines={2}
                className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
                style={{ textAlignVertical: 'top', minHeight: 60 }}
                maxLength={500}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {!alreadyBid && (
        <View className="px-5 pb-8 pt-3 bg-card border-t border-border">
          <TouchableOpacity
            onPress={handleBid}
            disabled={submitBid.isPending || !bidPrice}
            accessibilityLabel="Submit bid"
            className={`bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2 ${!bidPrice || submitBid.isPending ? 'opacity-50' : ''}`}
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
