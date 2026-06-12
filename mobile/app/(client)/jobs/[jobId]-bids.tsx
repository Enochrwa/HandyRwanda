// File: mobile/app/(client)/jobs/[jobId]-bids.tsx
// Sprint 11 — Client: view bids on a job + counter-offer flow (mobile)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import {
  NegotiationTimeline,
  type TimelineEvent,
} from '../../../src/components/NegotiationTimeline';
import api from '../../../src/services/api';

function formatRWF(n: number): string {
  return new Intl.NumberFormat('rw-RW').format(n);
}

interface Bid {
  id: string;
  artisan_id: string;
  artisan_name?: string;
  artisan_avatar?: string;
  artisan_rating?: number;
  artisan_total_reviews?: number;
  artisan_verification_status?: string;
  proposed_price: number;
  message?: string;
  cover_letter?: string;
  estimated_duration_hours?: number;
  status: string;
  created_at?: string;
  // Sprint 11
  negotiation_round: number;
  max_negotiation_rounds: number;
  counter_price?: number;
  counter_message?: string;
  counter_at?: string;
  artisan_counter_price?: number;
  artisan_counter_message?: string;
  artisan_counter_at?: string;
  current_offer_price?: number;
  is_negotiable?: boolean;
}

// ── Counter-offer modal ───────────────────────────────────────────────────────

function CounterOfferModal({
  visible,
  bid,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  bid: Bid | null;
  onClose: () => void;
  onSubmit: (bidId: string, price: number, message: string) => void;
  isSubmitting: boolean;
}) {
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');

  React.useEffect(() => {
    if (bid) {
      const suggested = Math.round(bid.proposed_price * 0.88);
      setPrice(String(suggested));
      setMessage('');
    }
  }, [bid]);

  if (!bid) return null;

  const parsed = parseInt(price, 10);
  const isValid = !isNaN(parsed) && parsed >= 500;
  const diff = isValid ? bid.proposed_price - parsed : 0;
  const diffPct = isValid ? Math.round((diff / bid.proposed_price) * 100) : 0;
  const roundsLeft = (bid.max_negotiation_rounds ?? 3) - bid.negotiation_round;

  const QUICK = [
    { label: '-5%', val: Math.round(bid.proposed_price * 0.95) },
    { label: '-10%', val: Math.round(bid.proposed_price * 0.9) },
    { label: '-15%', val: Math.round(bid.proposed_price * 0.85) },
    { label: '-20%', val: Math.round(bid.proposed_price * 0.8) },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="bg-card rounded-t-3xl overflow-hidden">
            {/* Handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-muted" />
            </View>

            <ScrollView
              className="px-5 pt-2 pb-10"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-lg font-extrabold text-foreground">
                    ⟷ Make a Counter-Offer
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {bid.artisan_name} asked {formatRWF(bid.proposed_price)} RWF
                    {' · '}
                    {roundsLeft} round{roundsLeft !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-muted items-center justify-center"
                >
                  <Text className="font-bold text-foreground">✕</Text>
                </TouchableOpacity>
              </View>

              {/* Round indicator */}
              <View className="flex-row gap-1.5 items-center mb-4">
                {Array.from({ length: bid.max_negotiation_rounds ?? 3 }).map((_, i) => (
                  <View
                    key={i}
                    className={`flex-1 h-1.5 rounded-full ${
                      i < bid.negotiation_round ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
                <Text className="text-[10px] text-muted-foreground ml-1">
                  {bid.negotiation_round}/{bid.max_negotiation_rounds ?? 3}
                </Text>
              </View>

              {/* Price input */}
              <Text className="text-xs font-bold text-foreground mb-2">Your offer (RWF)</Text>
              <View className="flex-row items-center gap-2 mb-1.5">
                <TouchableOpacity
                  onPress={() => {
                    const v = parseInt(price, 10);
                    if (!isNaN(v) && v > 500) setPrice(String(v - 500));
                  }}
                  className="w-10 h-10 rounded-xl border border-border bg-muted items-center justify-center"
                >
                  <Text className="font-bold text-lg text-foreground">−</Text>
                </TouchableOpacity>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="number-pad"
                  className="flex-1 h-10 bg-background border border-border rounded-xl px-3 text-center text-base font-extrabold text-foreground"
                />
                <TouchableOpacity
                  onPress={() => {
                    const v = parseInt(price, 10);
                    if (!isNaN(v)) setPrice(String(v + 500));
                  }}
                  className="w-10 h-10 rounded-xl border border-border bg-muted items-center justify-center"
                >
                  <Text className="font-bold text-lg text-foreground">+</Text>
                </TouchableOpacity>
              </View>

              {isValid && (
                <Text className={`text-xs mb-3 ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {diff > 0
                    ? `${diffPct}% less than artisan's ask (−${formatRWF(diff)} RWF)`
                    : diff < 0
                      ? `${Math.abs(diffPct)}% more than artisan's ask`
                      : "Same as artisan's ask"}
                </Text>
              )}

              {/* Quick buttons */}
              <View className="flex-row gap-2 mb-4 flex-wrap">
                {QUICK.map((q) => (
                  <TouchableOpacity
                    key={q.label}
                    onPress={() => setPrice(String(q.val))}
                    className="border border-border bg-muted/30 rounded-xl px-3 py-2"
                  >
                    <Text className="text-xs font-bold text-foreground">{q.label}</Text>
                    <Text className="text-[10px] text-muted-foreground">
                      {formatRWF(q.val)} RWF
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message */}
              <Text className="text-xs font-bold text-foreground mb-2">
                Note to artisan{' '}
                <Text className="font-normal text-muted-foreground">(optional)</Text>
              </Text>
              <TextInput
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, 300))}
                placeholder="Explain your offer…"
                multiline
                numberOfLines={2}
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm mb-1"
                style={{ textAlignVertical: 'top', minHeight: 60 }}
              />
              <Text className="text-[10px] text-muted-foreground text-right mb-4">
                {message.length}/300
              </Text>

              {/* Actions */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={onClose}
                  className="flex-1 border border-border rounded-2xl py-3.5 items-center"
                >
                  <Text className="font-semibold text-muted-foreground">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => isValid && onSubmit(bid.id, parsed, message)}
                  disabled={!isValid || isSubmitting}
                  className="flex-[2] bg-primary rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-extrabold">Send Counter-Offer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Bid card ──────────────────────────────────────────────────────────────────

function MobileBidCard({
  bid,
  jobStatus,
  priceMin,
  priceMax,
  onAccept,
  onDecline,
  onCounter,
  onArtisanCounterAccept,
  onArtisanCounterReject,
  isAccepting,
  isDeclining,
  isArtisanAccepting,
  isArtisanRejecting,
}: {
  bid: Bid;
  jobStatus?: string;
  priceMin: number;
  priceMax: number;
  onAccept: (bid: Bid) => void;
  onDecline: (bid: Bid) => void;
  onCounter: (bid: Bid) => void;
  onArtisanCounterAccept: (bid: Bid) => void;
  onArtisanCounterReject: (bid: Bid) => void;
  isAccepting: boolean;
  isDeclining: boolean;
  isArtisanAccepting: boolean;
  isArtisanRejecting: boolean;
}) {
  const [showTimeline, setShowTimeline] = useState(false);

  const { data: historyData } = useQuery<{ timeline: TimelineEvent[] }>({
    queryKey: ['negotiation-history', bid.id],
    queryFn: () => api.get(`/bids/${bid.id}/negotiation-history`).then((r) => r.data),
    enabled: showTimeline && bid.negotiation_round > 0,
    staleTime: 10_000,
  });

  const accepted = bid.status === 'accepted';
  const rejected = bid.status === 'rejected';
  const expired = bid.status === 'negotiation_expired';
  const clientCounterPending = bid.status === 'countered_by_client';
  const artisanCounterReceived = bid.status === 'artisan_countered';
  const canAct =
    jobStatus === 'open' && !accepted && !rejected && !expired && !clientCounterPending;
  const displayPrice = bid.current_offer_price ?? bid.proposed_price;
  const hasHistory = bid.negotiation_round > 0;

  const range = priceMax - priceMin;
  const pricePct =
    range > 0 ? Math.min(100, Math.max(0, ((displayPrice - priceMin) / range) * 100)) : 50;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      className={`bg-card rounded-3xl border mb-4 overflow-hidden ${
        artisanCounterReceived
          ? 'border-blue-300'
          : clientCounterPending
            ? 'border-amber-300'
            : accepted
              ? 'border-green-300'
              : 'border-border'
      }`}
      style={{ elevation: artisanCounterReceived ? 5 : 2 }}
    >
      {/* Status banner */}
      {accepted && (
        <View className="bg-green-600 px-4 py-2">
          <Text className="text-white text-xs font-bold">✅ Bid Accepted — Booking Created</Text>
        </View>
      )}
      {artisanCounterReceived && (
        <View className="bg-blue-600 px-4 py-2">
          <Text className="text-white text-xs font-bold">🔄 Artisan proposed a new price</Text>
        </View>
      )}
      {clientCounterPending && (
        <View className="bg-amber-100 border-b border-amber-200 px-4 py-2">
          <Text className="text-amber-800 text-xs font-bold">
            ⏳ Counter-offer sent · Awaiting artisan
          </Text>
        </View>
      )}
      {expired && (
        <View className="bg-red-50 border-b border-red-100 px-4 py-2">
          <Text className="text-red-600 text-xs font-semibold">⌛ Negotiation expired</Text>
        </View>
      )}

      <View className="p-4">
        {/* Artisan info row */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-11 h-11 rounded-xl bg-primary/10 items-center justify-center">
              <Text className="text-lg font-extrabold text-primary">
                {bid.artisan_name?.charAt(0).toUpperCase() ?? 'A'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-bold text-foreground" numberOfLines={1}>
                {bid.artisan_name ?? 'Artisan'}
              </Text>
              {bid.artisan_rating != null && (
                <Text className="text-xs text-muted-foreground">
                  ⭐ {bid.artisan_rating.toFixed(1)}{' '}
                  {bid.artisan_total_reviews != null && `(${bid.artisan_total_reviews})`}
                </Text>
              )}
            </View>
          </View>
          {/* Price */}
          <View className="items-end">
            <Text className="text-xl font-extrabold text-foreground">
              {formatRWF(displayPrice)}
            </Text>
            <Text className="text-[10px] text-muted-foreground">RWF</Text>
            {hasHistory && displayPrice !== bid.proposed_price && (
              <Text className="text-[10px] text-muted-foreground line-through">
                {formatRWF(bid.proposed_price)}
              </Text>
            )}
          </View>
        </View>

        {/* Negotiation round bar */}
        {hasHistory && (
          <View className="flex-row gap-1 items-center mb-3">
            {Array.from({ length: bid.max_negotiation_rounds ?? 3 }).map((_, i) => (
              <View
                key={i}
                className={`flex-1 h-1 rounded-full ${
                  i < bid.negotiation_round ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
            <Text className="text-[10px] text-muted-foreground ml-1">
              {bid.negotiation_round}/{bid.max_negotiation_rounds ?? 3}
            </Text>
          </View>
        )}

        {/* Price bar */}
        {range > 0 && (
          <View className="mb-3">
            <View className="h-1.5 rounded-full bg-muted overflow-hidden">
              <View
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, pricePct)}%` }}
              />
            </View>
          </View>
        )}

        {/* Message */}
        {(bid.cover_letter || bid.message) && (
          <Text
            className="text-xs text-muted-foreground italic mb-3 border-l-2 border-primary/30 pl-3"
            numberOfLines={3}
          >
            "{bid.cover_letter ?? bid.message}"
          </Text>
        )}

        {/* Client counter pending note */}
        {clientCounterPending && bid.counter_price && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
            <Text className="text-xs font-bold text-amber-800">Your counter-offer</Text>
            <Text className="text-base font-extrabold text-amber-700 mt-0.5">
              {formatRWF(bid.counter_price)} RWF
            </Text>
            {bid.counter_message && (
              <Text className="text-xs italic text-amber-700 mt-1">"{bid.counter_message}"</Text>
            )}
          </View>
        )}

        {/* Artisan counter-offer: accept / reject */}
        {artisanCounterReceived && bid.artisan_counter_price && (
          <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-[10px] font-bold text-blue-600 uppercase">
                  Artisan proposes
                </Text>
                <Text className="text-xl font-extrabold text-blue-700">
                  {formatRWF(bid.artisan_counter_price)} RWF
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] text-blue-500">vs original</Text>
                <Text className="font-bold text-blue-600">
                  -{formatRWF(bid.proposed_price - bid.artisan_counter_price)} RWF
                </Text>
              </View>
            </View>
            {bid.artisan_counter_message && (
              <Text className="text-xs italic text-blue-700 mt-1.5">
                "{bid.artisan_counter_message}"
              </Text>
            )}
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity
                onPress={() => onArtisanCounterReject(bid)}
                disabled={isArtisanRejecting || isArtisanAccepting}
                className="flex-1 border border-border bg-white rounded-xl py-2.5 items-center"
              >
                {isArtisanRejecting ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text className="text-xs font-semibold text-muted-foreground">Decline</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onArtisanCounterAccept(bid)}
                disabled={isArtisanAccepting || isArtisanRejecting}
                className="flex-[2] bg-blue-600 rounded-xl py-2.5 items-center"
              >
                {isArtisanAccepting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-xs font-bold text-white">
                    Accept {formatRWF(bid.artisan_counter_price)} RWF
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Negotiation history */}
        {hasHistory && (
          <TouchableOpacity
            onPress={() => setShowTimeline((p) => !p)}
            className="flex-row items-center gap-1.5 mb-3"
          >
            <Text className="text-[11px] text-primary font-semibold">
              {showTimeline ? '▲ Hide history' : '▼ View negotiation history'}
            </Text>
          </TouchableOpacity>
        )}
        {showTimeline && historyData && <NegotiationTimeline events={historyData.timeline} />}

        {/* Footer actions */}
        {canAct && (
          <View className="flex-row gap-2 mt-2 pt-3 border-t border-border">
            <TouchableOpacity
              onPress={() => onDecline(bid)}
              disabled={isDeclining || isAccepting}
              className="flex-1 border border-border rounded-xl py-2.5 items-center"
            >
              {isDeclining ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-xs font-semibold text-muted-foreground">Decline</Text>
              )}
            </TouchableOpacity>
            {(bid.is_negotiable ?? true) && (
              <TouchableOpacity
                onPress={() => onCounter(bid)}
                disabled={isAccepting || isDeclining}
                className="flex-1 border-2 border-primary/40 bg-primary/5 rounded-xl py-2.5 items-center"
              >
                <Text className="text-xs font-bold text-primary">⟷ Counter</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onAccept(bid)}
              disabled={isAccepting || isDeclining}
              className="flex-[1.5] bg-primary rounded-xl py-2.5 items-center"
            >
              {isAccepting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-xs font-bold text-white">Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ClientJobBids() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [counterBid, setCounterBid] = useState<Bid | null>(null);
  const [acceptBid, setAcceptBid] = useState<Bid | null>(null);

  const { data: jobData, isLoading: jobLoading } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
    staleTime: 30_000,
  });

  const {
    data: bids = [],
    isLoading: bidsLoading,
    refetch,
  } = useQuery<Bid[]>({
    queryKey: ['job-bids-mobile', jobId],
    queryFn: () => api.get(`/bids/jobs/${jobId}`).then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 12_000,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const job = jobData?.job ?? jobData;

  const priceMin = bids.length
    ? Math.min(...bids.map((b) => b.current_offer_price ?? b.proposed_price))
    : 0;
  const priceMax = bids.length
    ? Math.max(...bids.map((b) => b.current_offer_price ?? b.proposed_price))
    : 0;
  const negotiatingCount = bids.filter(
    (b) => b.status === 'countered_by_client' || b.status === 'artisan_countered',
  ).length;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/accept`),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '🎉 Bid accepted!', text2: 'Booking created.' });
      qc.invalidateQueries({ queryKey: ['job-bids-mobile', jobId] });
      qc.invalidateQueries({ queryKey: ['job-detail', jobId] });
      setAcceptBid(null);
      router.back();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Could not accept bid.',
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/reject`),
    onSuccess: () => {
      Toast.show({ type: 'info', text1: 'Bid declined.' });
      qc.invalidateQueries({ queryKey: ['job-bids-mobile', jobId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Error.',
      });
    },
  });

  const counterMutation = useMutation({
    mutationFn: ({
      bidId,
      counter_price,
      counter_message,
    }: {
      bidId: string;
      counter_price: number;
      counter_message?: string;
    }) => api.post(`/bids/${bidId}/counter`, { counter_price, counter_message }),
    onSuccess: (_, vars) => {
      Toast.show({ type: 'success', text1: '💬 Counter-offer sent!', text2: 'Artisan notified.' });
      qc.invalidateQueries({ queryKey: ['job-bids-mobile', jobId] });
      qc.invalidateQueries({ queryKey: ['negotiation-history', vars.bidId] });
      setCounterBid(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Counter failed.',
      });
    },
  });

  const artisanCounterAcceptMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/artisan-counter-accept`),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '🎉 Deal agreed!', text2: 'Booking created.' });
      qc.invalidateQueries({ queryKey: ['job-bids-mobile', jobId] });
      qc.invalidateQueries({ queryKey: ['job-detail', jobId] });
      router.back();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Error.',
      });
    },
  });

  const artisanCounterRejectMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/artisan-counter-reject`),
    onSuccess: () => {
      Toast.show({ type: 'info', text1: 'Artisan counter declined.' });
      qc.invalidateQueries({ queryKey: ['job-bids-mobile', jobId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Error.',
      });
    },
  });

  if (jobLoading || bidsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-14 pb-6 px-6 rounded-b-[32px]">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-white/70 text-sm">← Back</Text>
        </TouchableOpacity>
        <Text className="text-white text-xl font-extrabold" numberOfLines={2}>
          {job?.title ?? 'Job Bids'}
        </Text>
        <Text className="text-white/70 text-xs mt-1">
          {bids.length} bid{bids.length !== 1 ? 's' : ''} received
          {negotiatingCount > 0 && ` · ${negotiatingCount} in negotiation`}
        </Text>
        {bids.length > 1 && (
          <Text className="text-white/60 text-[11px] mt-0.5">
            Range: {formatRWF(priceMin)} – {formatRWF(priceMax)} RWF
          </Text>
        )}
      </View>

      <FlatList
        data={bids.sort((a, b) => {
          // Negotiation-active bids first
          const aActive = ['artisan_countered', 'countered_by_client'].includes(a.status) ? 0 : 1;
          const bActive = ['artisan_countered', 'countered_by_client'].includes(b.status) ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          // Then cheapest
          return (
            (a.current_offer_price ?? a.proposed_price) -
            (b.current_offer_price ?? b.proposed_price)
          );
        })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1B5E3B" />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-24">
            <Text className="text-4xl mb-4">📋</Text>
            <Text className="font-bold text-base text-foreground text-center">No bids yet</Text>
            <Text className="text-sm text-muted-foreground text-center mt-2 px-8">
              Artisans will start bidding soon. Check back in a few minutes!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MobileBidCard
            bid={item}
            jobStatus={job?.status}
            priceMin={priceMin}
            priceMax={priceMax}
            onAccept={setAcceptBid}
            onDecline={(b) => declineMutation.mutate(b.id)}
            onCounter={setCounterBid}
            onArtisanCounterAccept={(b) => artisanCounterAcceptMutation.mutate(b.id)}
            onArtisanCounterReject={(b) => artisanCounterRejectMutation.mutate(b.id)}
            isAccepting={acceptMutation.isPending && acceptMutation.variables === item.id}
            isDeclining={declineMutation.isPending && declineMutation.variables === item.id}
            isArtisanAccepting={
              artisanCounterAcceptMutation.isPending &&
              artisanCounterAcceptMutation.variables === item.id
            }
            isArtisanRejecting={
              artisanCounterRejectMutation.isPending &&
              artisanCounterRejectMutation.variables === item.id
            }
          />
        )}
        ListFooterComponent={
          bids.length > 0 ? (
            <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mt-2">
              <Text className="font-bold text-primary text-sm mb-1">
                💡 Price Negotiation is live!
              </Text>
              <Text className="text-xs text-muted-foreground">
                Tap <Text className="font-bold">⟷ Counter</Text> to propose a different price. Up to
                3 rounds of back-and-forth. All negotiation happens safely inside HandyRwanda.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Counter-offer modal */}
      <CounterOfferModal
        visible={!!counterBid}
        bid={counterBid}
        onClose={() => setCounterBid(null)}
        onSubmit={(bidId, price, message) =>
          counterMutation.mutate({
            bidId,
            counter_price: price,
            counter_message: message || undefined,
          })
        }
        isSubmitting={counterMutation.isPending}
      />

      {/* Accept confirmation bottom sheet */}
      {acceptBid && (
        <Modal
          visible={!!acceptBid}
          animationType="slide"
          transparent
          onRequestClose={() => setAcceptBid(null)}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-card rounded-t-3xl px-6 pt-4 pb-10">
              <View className="items-center mb-4">
                <View className="w-10 h-1 rounded-full bg-muted" />
              </View>
              <Text className="text-lg font-extrabold text-foreground mb-2">Accept this bid?</Text>
              <Text className="text-sm text-muted-foreground mb-5">
                You're accepting{' '}
                <Text className="font-bold text-foreground">{acceptBid.artisan_name}</Text>'s offer
                of{' '}
                <Text className="font-bold text-primary">
                  {formatRWF(acceptBid.current_offer_price ?? acceptBid.proposed_price)} RWF
                </Text>
                . A booking will be created and all other bids will be declined.
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setAcceptBid(null)}
                  className="flex-1 border border-border rounded-2xl py-3.5 items-center"
                >
                  <Text className="font-semibold text-muted-foreground">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => acceptMutation.mutate(acceptBid.id)}
                  disabled={acceptMutation.isPending}
                  className="flex-[2] bg-primary rounded-2xl py-3.5 items-center"
                >
                  {acceptMutation.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-extrabold">Accept Bid</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
