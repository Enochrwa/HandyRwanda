// File: mobile/app/(artisan)/reviews.tsx
/**
 * Sprint 2 — Artisan Review Reply (Mobile)
 *
 * Artisans see all their reviews and can publicly reply to each one.
 * Tapping "Reply" opens a bottom sheet; the reply is posted optimistically.
 * Already-replied reviews show the reply in a distinct quoted block.
 */

import { MessageCircle, Star, ChevronLeft, X, Send } from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  artisan_reply: string | null;
  client_name: string;
  client_avatar: string | null;
  created_at: string;
}

// ── Star component ────────────────────────────────────────────────────────────

const StarRow = ({ rating }: { rating: number }) => (
  <View className="flex-row gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={13}
        color="#E8A020"
        fill={i < rating ? '#E8A020' : 'none'}
      />
    ))}
  </View>
);

// ── Rating summary badge ─────────────────────────────────────────────────────

const RatingSummary = ({ reviews }: { reviews: Review[] }) => {
  if (!reviews.length) return null;
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }));

  return (
    <View className="bg-card border border-border rounded-3xl p-5 mx-5 mb-4 shadow-sm">
      <View className="flex-row items-center gap-4">
        <View className="items-center">
          <Text className="text-5xl font-black text-foreground">{avg.toFixed(1)}</Text>
          <StarRow rating={Math.round(avg)} />
          <Text className="text-xs text-muted-foreground mt-1">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          {dist.map(({ n, count }) => (
            <View key={n} className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-2">{n}</Text>
              <View className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full bg-accent rounded-full"
                  style={{
                    width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%',
                  }}
                />
              </View>
              <Text className="text-xs text-muted-foreground w-4 text-right">{count}</Text>
            </View>
          ))}
        </View>
      </View>
      {/* Reply rate */}
      <View className="mt-4 flex-row items-center justify-between bg-primary/5 rounded-2xl p-3">
        <View className="flex-row items-center gap-2">
          <MessageCircle size={16} color="#1B5E3B" />
          <Text className="text-xs font-semibold text-primary">Reply rate</Text>
        </View>
        <Text className="text-sm font-bold text-primary">
          {reviews.length
            ? `${Math.round((reviews.filter((r) => r.artisan_reply).length / reviews.length) * 100)}%`
            : '—'}
        </Text>
      </View>
    </View>
  );
};

// ── Reply bottom sheet ────────────────────────────────────────────────────────

interface ReplySheetProps {
  visible: boolean;
  review: Review | null;
  onClose: () => void;
  onSubmit: (reviewId: string, reply: string) => void;
  isSubmitting: boolean;
}

const ReplySheet = ({ visible, review, onClose, onSubmit, isSubmitting }: ReplySheetProps) => {
  const [replyText, setReplyText] = useState('');
  const MAX_CHARS = 300;
  const remaining = MAX_CHARS - replyText.length;

  const handleSubmit = () => {
    if (!replyText.trim() || !review) return;
    onSubmit(review.id, replyText.trim());
  };

  // Reset when sheet opens
  React.useEffect(() => {
    if (visible) setReplyText('');
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-[32px] pb-10">
            {/* Handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </View>

            {/* Header */}
            <View className="flex-row justify-between items-center px-5 pt-3 pb-4">
              <View>
                <Text className="text-xl font-extrabold text-foreground">Reply to Review</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Your reply will be visible publicly
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-9 h-9 rounded-full bg-muted items-center justify-center"
              >
                <X size={18} color="#6B6B6B" />
              </TouchableOpacity>
            </View>

            {/* Original review preview */}
            {review && (
              <View className="mx-5 bg-muted/50 rounded-2xl p-4 mb-4 border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-sm font-semibold text-foreground">{review.client_name}</Text>
                  <StarRow rating={review.rating} />
                </View>
                {review.comment && (
                  <Text className="text-sm text-muted-foreground leading-5" numberOfLines={3}>
                    {review.comment}
                  </Text>
                )}
              </View>
            )}

            {/* Text input */}
            <View className="mx-5">
              <TextInput
                value={replyText}
                onChangeText={(t) => setReplyText(t.slice(0, MAX_CHARS))}
                placeholder="Thank the client, address their concern, or explain your work…"
                multiline
                numberOfLines={4}
                className="bg-muted/50 p-4 rounded-2xl border border-border text-sm text-foreground"
                style={{ textAlignVertical: 'top', minHeight: 100 }}
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <Text
                className={`text-right text-xs mt-1 ${remaining < 30 ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {remaining} characters left
              </Text>
            </View>

            {/* Tip */}
            <View className="mx-5 mt-3 bg-blue-50 border border-blue-100 rounded-2xl p-3">
              <Text className="text-xs text-blue-700 font-semibold">
                💡 Tip: Professional responses build trust with future clients.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || replyText.trim().length < 10}
              className={`mx-5 mt-4 py-4 rounded-2xl flex-row items-center justify-center gap-2 ${
                isSubmitting || replyText.trim().length < 10
                  ? 'bg-primary/40'
                  : 'bg-primary'
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send size={16} color="white" />
                  <Text className="text-white font-bold text-base">Post Reply</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Review card ───────────────────────────────────────────────────────────────

interface ReviewCardProps {
  review: Review;
  onReply: (review: Review) => void;
  optimisticReply: string | null;
}

const ReviewCard = ({ review, onReply, optimisticReply }: ReviewCardProps) => {
  const reply = optimisticReply ?? review.artisan_reply;
  const hasReply = Boolean(reply);
  const timeAgo = review.created_at
    ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true })
    : '';

  return (
    <View className="bg-card rounded-3xl border border-border shadow-sm mx-5 mb-3 overflow-hidden">
      {/* Rating badge accent */}
      <View
        className="absolute top-0 right-0 w-16 h-16 rounded-bl-full items-center justify-center"
        style={{
          backgroundColor:
            review.rating >= 4 ? '#1B5E3B15' : review.rating === 3 ? '#E8A02015' : '#C0392B15',
        }}
      >
        <Text
          className="text-lg font-black"
          style={{
            color:
              review.rating >= 4
                ? '#1B5E3B'
                : review.rating === 3
                  ? '#E8A020'
                  : '#C0392B',
          }}
        >
          {review.rating}★
        </Text>
      </View>

      <View className="p-4">
        {/* Client info */}
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
            <Text className="text-primary font-bold text-base">
              {review.client_name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-bold text-foreground text-sm">{review.client_name}</Text>
            <Text className="text-xs text-muted-foreground">{timeAgo}</Text>
          </View>
          <StarRow rating={review.rating} />
        </View>

        {/* Review text */}
        {review.comment ? (
          <Text className="text-sm text-foreground leading-6 mb-3">{review.comment}</Text>
        ) : (
          <Text className="text-sm text-muted-foreground italic mb-3">No written comment</Text>
        )}

        {/* Artisan reply */}
        {hasReply ? (
          <View className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
            <View className="flex-row items-center gap-1.5 mb-1.5">
              <MessageCircle size={12} color="#1B5E3B" />
              <Text className="text-xs font-bold text-primary uppercase tracking-wide">
                Your response
              </Text>
              {optimisticReply && (
                <View className="ml-auto bg-accent/10 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-accent">Just posted</Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-foreground leading-5">{reply}</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => onReply(review)}
            className="flex-row items-center gap-2 bg-muted/60 border border-border rounded-2xl p-3"
          >
            <MessageCircle size={15} color="#1B5E3B" />
            <Text className="text-sm font-semibold text-primary">Reply to this review</Text>
            <Text className="ml-auto text-xs text-muted-foreground">→</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ArtisanReviewsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  // Optimistic replies: { reviewId: replyText }
  const [optimisticReplies, setOptimisticReplies] = useState<Record<string, string>>({});
  const [filterReplied, setFilterReplied] = useState<'all' | 'pending' | 'replied'>('all');

  const { data: reviews = [], isLoading, refetch, isRefetching } = useQuery<Review[]>({
    queryKey: ['artisan-reviews-mine'],
    queryFn: () => api.get('/reviews/mine').then((r) => r.data),
    enabled: !!user?.id,
  });

  const replyMutation = useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) =>
      api.patch(`/reviews/${reviewId}/reply`, { reply }),
    onMutate: ({ reviewId, reply }) => {
      // Optimistic update
      setOptimisticReplies((prev) => ({ ...prev, [reviewId]: reply }));
    },
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: ['artisan-reviews-mine'] });
      Toast.show({
        type: 'success',
        text1: 'Reply posted! ✓',
        text2: 'Clients can now see your response.',
      });
    },
    onError: (_, { reviewId }) => {
      setOptimisticReplies((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
      Toast.show({ type: 'error', text1: 'Failed to post reply', text2: 'Please try again.' });
    },
  });

  const handleOpenReply = useCallback((review: Review) => {
    setSelectedReview(review);
    setSheetVisible(true);
  }, []);

  const handleSubmitReply = useCallback(
    (reviewId: string, reply: string) => {
      replyMutation.mutate(
        { reviewId, reply },
        {
          onSuccess: () => {
            setSheetVisible(false);
            setSelectedReview(null);
          },
        },
      );
    },
    [replyMutation],
  );

  const filteredReviews = reviews.filter((r) => {
    const hasReply = Boolean(optimisticReplies[r.id] ?? r.artisan_reply);
    if (filterReplied === 'pending') return !hasReply;
    if (filterReplied === 'replied') return hasReply;
    return true;
  });

  const pendingCount = reviews.filter(
    (r) => !optimisticReplies[r.id] && !r.artisan_reply,
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-muted items-center justify-center mr-3"
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-extrabold text-foreground">My Reviews</Text>
          {pendingCount > 0 && (
            <Text className="text-xs text-accent font-semibold">
              {pendingCount} awaiting your reply
            </Text>
          )}
        </View>
        {pendingCount > 0 && (
          <View className="bg-accent w-6 h-6 rounded-full items-center justify-center">
            <Text className="text-white text-xs font-black">{pendingCount}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
          <Text className="text-muted-foreground text-sm mt-3">Loading your reviews…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <RatingSummary reviews={reviews} />

              {/* Filter pills */}
              <View className="flex-row gap-2 px-5 mb-4">
                {(
                  [
                    ['all', `All (${reviews.length})`],
                    ['pending', `Pending (${pendingCount})`],
                    ['replied', `Replied (${reviews.length - pendingCount})`],
                  ] as const
                ).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setFilterReplied(key)}
                    className={`flex-1 py-2.5 rounded-xl border-2 items-center ${
                      filterReplied === key
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        filterReplied === key ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              onReply={handleOpenReply}
              optimisticReply={optimisticReplies[item.id] ?? null}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center px-10 mt-10">
              <View className="w-20 h-20 rounded-full bg-muted items-center justify-center mb-4">
                <Star size={36} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-bold text-center text-foreground">
                {filterReplied === 'pending' ? 'All caught up!' : 'No reviews yet'}
              </Text>
              <Text className="text-sm text-muted-foreground text-center mt-2 leading-5">
                {filterReplied === 'pending'
                  ? "You've replied to all your reviews. Great job! 🎉"
                  : 'Complete jobs to receive your first review.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      <ReplySheet
        visible={sheetVisible}
        review={selectedReview}
        onClose={() => {
          setSheetVisible(false);
          setSelectedReview(null);
        }}
        onSubmit={handleSubmitReply}
        isSubmitting={replyMutation.isPending}
      />
    </SafeAreaView>
  );
}
