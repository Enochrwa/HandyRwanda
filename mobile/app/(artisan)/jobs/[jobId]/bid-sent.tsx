// File: mobile/app/(artisan)/jobs/[jobId]/bid-sent.tsx
import { CheckCircle, ArrowRight } from '@icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function BidSentSuccess() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      {/* Success icon */}
      <View className="w-24 h-24 rounded-full bg-success/10 items-center justify-center mb-6">
        <CheckCircle size={48} color="#1B5E3B" />
      </View>

      <Text className="text-3xl font-extrabold text-center mb-3">Bid Sent! 🎉</Text>
      <Text className="text-muted-foreground text-center leading-6 mb-10">
        Your bid has been submitted. We'll notify you as soon as the client responds.
        Keep checking the jobs feed for more opportunities!
      </Text>

      {/* Tips card */}
      <View className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-8">
        <Text className="font-bold text-primary mb-3">💡 Pro Tips</Text>
        <View className="space-y-2">
          {[
            'Add portfolio photos to win more jobs',
            'Respond quickly when clients message you',
            'Get ID verified to appear higher in search',
          ].map((tip) => (
            <View key={tip} className="flex-row items-start gap-2 mb-1.5">
              <Text className="text-success">✓</Text>
              <Text className="text-sm text-foreground flex-1">{tip}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={() => router.replace('/(artisan)/jobs')}
        accessibilityLabel="Browse more jobs"
        className="w-full bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2 mb-3"
      >
        <Text className="text-white font-extrabold text-base">Browse More Jobs</Text>
        <ArrowRight size={18} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace('/(tabs)/pro')}
        accessibilityLabel="Go to dashboard"
        className="w-full bg-muted rounded-2xl py-4 items-center border border-border"
      >
        <Text className="font-bold text-foreground">Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}
