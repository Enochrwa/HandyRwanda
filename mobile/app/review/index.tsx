// File: mobile/app/review/index.tsx
import { Star } from '@icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';

const LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
const QUICK_TAGS = [
  'On time',
  'Professional',
  'Great quality',
  'Good communication',
  'Exceeded expectations',
  'Fair price',
  'Would hire again',
];

export default function ReviewScreen() {
  const router = useRouter();
  const { bookingId, artisanName } = useLocalSearchParams<{
    bookingId: string;
    artisanName: string;
  }>();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 4),
    );

  const buildComment = () => {
    const parts: string[] = [];
    if (selectedTags.length) parts.push(selectedTags.join(', ') + '.');
    if (comment.trim()) parts.push(comment.trim());
    return parts.join(' ') || undefined;
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Toast.show({ type: 'error', text1: 'Please select a rating' });
      return;
    }
    setLoading(true);
    try {
      await api.post(`/reviews/${bookingId}`, { rating, comment: buildComment() });
      Toast.show({ type: 'success', text1: 'Review submitted! 🙏' });
      router.replace('/(tabs)');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Toast.show({ type: 'error', text1: typeof detail === 'string' ? detail : 'Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const displayRating = hovered || rating;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1 px-5 pt-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="self-end mb-4">
          <Text className="text-muted-foreground text-sm">Skip</Text>
        </TouchableOpacity>

        <View className="items-center mb-8">
          <Text style={{ fontSize: 48 }} className="mb-3">
            🎉
          </Text>
          <Text className="text-2xl font-extrabold text-center">Job Complete!</Text>
          <Text className="text-muted-foreground text-sm text-center mt-1">
            How was your experience with{' '}
            <Text className="font-bold text-foreground">
              {artisanName?.split(' ')[0] ?? 'the artisan'}?
            </Text>
          </Text>
        </View>

        {/* Star rating */}
        <View className="flex-row justify-center mb-2 gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              onPressIn={() => setHovered(star)}
              onPressOut={() => setHovered(0)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Star
                size={40}
                color={star <= displayRating ? '#FBBF24' : '#D1D5DB'}
                fill={star <= displayRating ? '#FBBF24' : 'transparent'}
              />
            </TouchableOpacity>
          ))}
        </View>
        {displayRating > 0 && (
          <Text className="text-center text-muted-foreground text-sm mb-5">
            {LABELS[displayRating - 1]}
          </Text>
        )}

        {/* Quick tags */}
        <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 mt-1">
          What stood out? <Text className="font-normal">(optional)</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-5">
          {QUICK_TAGS.map((tag) => (
            <TouchableOpacity
              key={tag}
              onPress={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full border ${
                selectedTags.includes(tag) ? 'bg-primary border-primary' : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${selectedTags.includes(tag) ? 'text-white' : 'text-foreground'}`}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Written comment */}
        <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
          Your review <Text className="font-normal">(optional)</Text>
        </Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Tell others about your experience…"
          multiline
          numberOfLines={3}
          maxLength={500}
          className="bg-card border border-border rounded-2xl px-4 py-3 text-foreground text-sm mb-1"
          style={{ textAlignVertical: 'top', minHeight: 80 }}
        />
        <Text className="text-[10px] text-muted-foreground text-right mb-6">
          {comment.length}/500
        </Text>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || rating === 0}
          className={`bg-primary rounded-2xl py-4 items-center ${loading || rating === 0 ? 'opacity-50' : ''}`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-extrabold text-base">Submit Review</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
