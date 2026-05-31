// File: mobile/app/(artisan)/jobs/[jobId]/index.tsx
import { ArrowRight } from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../../src/services/api';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

export default function JobDetailBid() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const qc = useQueryClient();
  const [bidPrice, setBidPrice] = useState('');
  const [message, setMessage] = useState('');

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => ({ ...r.data.job, price_guidance: r.data.price_guidance, bid_count: r.data.bid_count })),
    enabled: !!jobId,
  });

  const submitBid = useMutation({
    mutationFn: () => api.post(`/bids/jobs/${jobId}`, {
      proposed_price: parseInt(bidPrice, 10),
      message: message.trim() || undefined,
    }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '🎉 Bid submitted!', text2: 'You\'ll be notified if accepted.' });
      qc.invalidateQueries({ queryKey: ['open-jobs'] });
      router.back();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail;
      Toast.show({ type: 'error', text1: 'Failed', text2: typeof msg === 'string' ? msg : 'Try again.' });
    },
  });

  const handleBid = () => {
    const price = parseInt(bidPrice, 10);
    if (!bidPrice || isNaN(price) || price < 500) {
      Toast.show({ type: 'error', text1: 'Invalid price', text2: 'Enter a price of at least 500 RWF' });
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
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" className="mb-3">
          <Text className="text-primary font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-extrabold">{job.title}</Text>
        {job.category?.name_en && (
          <View className="mt-1.5 bg-primary/10 self-start px-2.5 py-0.5 rounded-full">
            <Text className="text-primary text-xs font-bold">{job.category.icon_emoji} {job.category.name_en}</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Job info */}
        <View className="bg-card rounded-3xl border border-border p-5 mb-5">
          <Text className="text-sm text-foreground leading-6">{job.description}</Text>

          <View className="flex-row flex-wrap gap-3 mt-4 pt-4 border-t border-border">
            {job.budget && (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">Budget</Text>
                <Text className="font-bold text-foreground">{formatRWF(job.budget)} RWF</Text>
              </View>
            )}
            {job.location_label && (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">Location</Text>
                <Text className="font-bold text-foreground">{job.location_label}</Text>
              </View>
            )}
            {job.bid_count !== undefined && (
              <View>
                <Text className="text-[10px] font-bold uppercase text-muted-foreground">Bids so far</Text>
                <Text className="font-bold text-foreground">{job.bid_count}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Job photos */}
        {((job.images ?? job.photos_urls) as string[] | undefined)?.length ? (
          <View className="mb-5">
            <Text className="font-bold mb-2">Client Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
              {((job.images ?? job.photos_urls) as string[]).map((url: string, i: number) => (
                <Image key={i} source={{ uri: url }} className="w-36 h-36 rounded-2xl mr-3 bg-muted" resizeMode="cover" />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Bid form */}
        <View className="bg-card rounded-3xl border border-border p-5 mb-8">
          <Text className="text-base font-extrabold mb-4">Submit Your Bid</Text>

          <View className="mb-4">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Your Price (RWF) *
            </Text>
            <TextInput
              value={bidPrice}
              onChangeText={setBidPrice}
              placeholder={job.budget ? `Client budget: ${formatRWF(job.budget)}` : 'Enter your price'}
              keyboardType="number-pad"
              className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
            />
          </View>

          <View className="mb-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              Message to Client (optional)
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Why are you the right person? Any questions for the client?"
              multiline
              numberOfLines={3}
              className="bg-muted/40 p-4 rounded-2xl border border-border text-foreground text-sm"
              style={{ textAlignVertical: 'top', minHeight: 80 }}
              maxLength={300}
            />
          </View>
        </View>
      </ScrollView>

      <View className="px-5 pb-8 pt-3 bg-card border-t border-border">
        <TouchableOpacity
          onPress={handleBid}
          disabled={submitBid.isPending || !bidPrice}
          accessibilityLabel="Submit bid"
          className={`bg-accent rounded-2xl py-4 items-center flex-row justify-center gap-2 ${(!bidPrice || submitBid.isPending) ? 'opacity-50' : ''}`}
        >
          {submitBid.isPending
            ? <ActivityIndicator color="white" />
            : <>
                <Text className="text-white font-extrabold text-base">Send Bid</Text>
                <ArrowRight size={18} color="white" />
              </>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
