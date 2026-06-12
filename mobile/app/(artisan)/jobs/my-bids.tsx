// File: mobile/app/(artisan)/jobs/my-bids.tsx
// Sprint 11 — Artisan's submitted bids list with full negotiation UI
// Shows: pending bids, counter-offers received, negotiation history

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import { NegotiationSheet } from '../../../src/components/NegotiationSheet';
import {
  NegotiationTimeline,
  type TimelineEvent,
} from '../../../src/components/NegotiationTimeline';
import api from '../../../src/services/api';

function formatRWF(n: number): string {
  return new Intl.NumberFormat('rw-RW').format(n);
}

interface BidItem {
  id: string;
  job_id: string;
  proposed_price: number;
  message?: string;
  cover_letter?: string;
  estimated_duration_hours?: number;
  status: string;
  created_at?: string;
  // negotiation
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
  // job info (may be nested or flat)
  job_title?: string;
  job_category?: string;
  client_name?: string;
  location_label?: string;
}

interface NegotiationHistoryData {
  timeline: TimelineEvent[];
  summary: { original_ask: number; current_offer: number; savings: number };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; emoji: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: 'Awaiting Response',
    emoji: '⏳',
    bgColor: '#FFF7ED',
    textColor: '#C2410C',
  },
  countered_by_client: {
    label: 'Counter-Offer Received',
    emoji: '💬',
    bgColor: '#EFF6FF',
    textColor: '#1D4ED8',
  },
  artisan_countered: {
    label: 'Counter Sent',
    emoji: '🔄',
    bgColor: '#F5F3FF',
    textColor: '#7C3AED',
  },
  accepted: {
    label: 'Accepted ✅',
    emoji: '🎉',
    bgColor: '#F0FDF4',
    textColor: '#15803D',
  },
  rejected: {
    label: 'Declined',
    emoji: '❌',
    bgColor: '#F9FAFB',
    textColor: '#6B7280',
  },
  negotiation_expired: {
    label: 'Negotiation Expired',
    emoji: '⌛',
    bgColor: '#FEF2F2',
    textColor: '#DC2626',
  },
};

// ── Bid card ──────────────────────────────────────────────────────────────────

function BidCard({
  bid,
  onOpenNegotiation,
  onViewHistory,
}: {
  bid: BidItem;
  onOpenNegotiation: (bid: BidItem) => void;
  onViewHistory: (bid: BidItem) => void;
}) {
  const statusCfg = STATUS_CONFIG[bid.status] ?? {
    label: bid.status,
    emoji: '•',
    bgColor: '#F9FAFB',
    textColor: '#6B7280',
  };

  const hasCounter = bid.status === 'countered_by_client';
  const isActive = ['pending', 'countered_by_client', 'artisan_countered'].includes(bid.status);
  const hasNegotiationHistory = bid.negotiation_round > 0;
  const displayPrice = bid.current_offer_price ?? bid.proposed_price;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      className={`bg-card rounded-3xl border mb-4 overflow-hidden ${
        hasCounter ? 'border-blue-300' : isActive ? 'border-border' : 'border-border/50'
      }`}
      style={{ elevation: hasCounter ? 4 : 2 }}
    >
      {/* Counter-offer urgent banner */}
      {hasCounter && (
        <View className="bg-blue-600 px-4 py-2 flex-row items-center gap-2">
          <Text className="text-white text-xs font-bold">
            💬 Counter-offer received — action required
          </Text>
        </View>
      )}

      <View className="p-4">
        {/* Job title + status */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1 mr-3">
            <Text className="font-extrabold text-base text-foreground" numberOfLines={2}>
              {bid.job_title ?? 'Job'}
            </Text>
            {bid.location_label && (
              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                📍 {bid.location_label}
              </Text>
            )}
          </View>
          <View
            className="px-2.5 py-1 rounded-full shrink-0"
            style={{ backgroundColor: statusCfg.bgColor }}
          >
            <Text className="text-[10px] font-bold" style={{ color: statusCfg.textColor }}>
              {statusCfg.emoji} {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Price row */}
        <View className="flex-row items-end justify-between mb-3 pb-3 border-b border-border">
          <View>
            <Text className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
              {bid.status === 'countered_by_client' && bid.counter_price
                ? 'Client offers'
                : bid.status === 'artisan_countered' && bid.artisan_counter_price
                  ? 'Your counter'
                  : 'Your bid'}
            </Text>
            <Text className="text-2xl font-extrabold text-foreground">
              {formatRWF(displayPrice)}{' '}
              <Text className="text-sm font-normal text-muted-foreground">RWF</Text>
            </Text>
            {/* Show original if price changed */}
            {bid.negotiation_round > 0 && displayPrice !== bid.proposed_price && (
              <Text className="text-xs text-muted-foreground line-through">
                Originally: {formatRWF(bid.proposed_price)} RWF
              </Text>
            )}
          </View>

          {/* Negotiation round indicator */}
          {bid.negotiation_round > 0 && (
            <View className="items-end">
              <View className="flex-row gap-1">
                {Array.from({ length: bid.max_negotiation_rounds }).map((_, i) => (
                  <View
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full ${
                      i < bid.negotiation_round ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </View>
              <Text className="text-[10px] text-muted-foreground mt-0.5">
                Round {bid.negotiation_round}/{bid.max_negotiation_rounds}
              </Text>
            </View>
          )}
        </View>

        {/* Counter-offer details when status is countered_by_client */}
        {hasCounter && bid.counter_price && (
          <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-bold text-blue-600 uppercase">
                  {bid.client_name ?? 'Client'} offers
                </Text>
                <Text className="text-xl font-extrabold text-blue-700">
                  {formatRWF(bid.counter_price)} RWF
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] text-blue-500">vs your ask</Text>
                <Text className="font-bold text-blue-600">
                  -{formatRWF(bid.proposed_price - bid.counter_price)} RWF
                </Text>
                <Text className="text-[10px] text-blue-500">
                  (
                  {Math.round(
                    ((bid.proposed_price - bid.counter_price) / bid.proposed_price) * 100,
                  )}
                  % less)
                </Text>
              </View>
            </View>
            {bid.counter_message && (
              <Text className="text-xs text-blue-700 italic mt-2">"{bid.counter_message}"</Text>
            )}
          </View>
        )}

        {/* Artisan counter sent banner */}
        {bid.status === 'artisan_countered' && bid.artisan_counter_price && (
          <View className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3">
            <Text className="text-[10px] font-bold text-purple-600 uppercase mb-1">
              Your counter-proposal sent
            </Text>
            <Text className="text-lg font-extrabold text-purple-700">
              {formatRWF(bid.artisan_counter_price)} RWF
            </Text>
            {bid.artisan_counter_message && (
              <Text className="text-xs text-purple-700 italic mt-1">
                "{bid.artisan_counter_message}"
              </Text>
            )}
            <Text className="text-[10px] text-purple-500 mt-1">Awaiting client response…</Text>
          </View>
        )}

        {/* Meta row */}
        <View className="flex-row items-center justify-between">
          <Text className="text-[10px] text-muted-foreground">
            {bid.created_at
              ? formatDistanceToNow(new Date(bid.created_at), { addSuffix: true })
              : ''}
            {bid.estimated_duration_hours && ` · ~${bid.estimated_duration_hours}h`}
          </Text>

          <View className="flex-row gap-2">
            {/* View history */}
            {hasNegotiationHistory && (
              <TouchableOpacity
                onPress={() => onViewHistory(bid)}
                className="border border-border rounded-xl px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-muted-foreground">📋 History</Text>
              </TouchableOpacity>
            )}

            {/* Negotiate button */}
            {hasCounter && (
              <TouchableOpacity
                onPress={() => onOpenNegotiation(bid)}
                className="bg-blue-600 rounded-xl px-4 py-1.5"
              >
                <Text className="text-xs font-bold text-white">Respond</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── History modal ─────────────────────────────────────────────────────────────

function HistoryModal({
  visible,
  bid,
  onClose,
}: {
  visible: boolean;
  bid: BidItem | null;
  onClose: () => void;
}) {
  const { data: history, isLoading } = useQuery<NegotiationHistoryData>({
    queryKey: ['negotiation-history', bid?.id],
    queryFn: () => api.get(`/bids/${bid!.id}/negotiation-history`).then((r) => r.data),
    enabled: visible && !!bid,
    staleTime: 10_000,
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-card rounded-t-3xl px-5 pt-4 pb-10">
          <View className="items-center mb-3">
            <View className="w-10 h-1 rounded-full bg-muted" />
          </View>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-extrabold text-foreground">📋 Negotiation History</Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-muted items-center justify-center"
            >
              <Text className="font-bold text-foreground">✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator color="#1B5E3B" />
            </View>
          ) : history ? (
            <>
              {/* Summary */}
              <View className="flex-row justify-between bg-muted/30 rounded-xl p-3 mb-3">
                <View className="items-center">
                  <Text className="text-[10px] text-muted-foreground">Original ask</Text>
                  <Text className="font-bold text-sm">
                    {formatRWF(history.summary.original_ask)} RWF
                  </Text>
                </View>
                <View className="items-center">
                  <Text className="text-[10px] text-muted-foreground">Final price</Text>
                  <Text className="font-bold text-sm text-primary">
                    {formatRWF(history.summary.current_offer)} RWF
                  </Text>
                </View>
                {history.summary.savings > 0 && (
                  <View className="items-center">
                    <Text className="text-[10px] text-muted-foreground">Saved</Text>
                    <Text className="font-bold text-sm text-green-600">
                      -{formatRWF(history.summary.savings)} RWF
                    </Text>
                  </View>
                )}
              </View>

              <NegotiationTimeline events={history.timeline} />
            </>
          ) : (
            <Text className="text-center text-muted-foreground py-8">No history available.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ArtisanMyBids() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [negotiationBid, setNegotiationBid] = useState<BidItem | null>(null);
  const [historyBid, setHistoryBid] = useState<BidItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch artisan's bids — we aggregate across all their jobs
  const {
    data: bids = [],
    isLoading,
    refetch,
  } = useQuery<BidItem[]>({
    queryKey: ['my-bids-artisan'],
    queryFn: () => api.get('/bids/my').then((r) => r.data),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Negotiation mutations ──────────────────────────────────────────────────

  const acceptCounterMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/counter-accept`),
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: '✅ Counter accepted!',
        text2: 'Booking created at the agreed price.',
      });
      setNegotiationBid(null);
      qc.invalidateQueries({ queryKey: ['my-bids-artisan'] });
      qc.invalidateQueries({ queryKey: ['artisan-active-bookings'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Could not accept counter.',
      });
    },
  });

  const rejectCounterMutation = useMutation({
    mutationFn: (bidId: string) => api.post(`/bids/${bidId}/counter-reject`),
    onSuccess: () => {
      Toast.show({ type: 'info', text1: 'Counter-offer declined.' });
      setNegotiationBid(null);
      qc.invalidateQueries({ queryKey: ['my-bids-artisan'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Could not reject counter.',
      });
    },
  });

  const proposeMiddleMutation = useMutation({
    mutationFn: ({
      bidId,
      artisan_counter_price,
      artisan_counter_message,
    }: {
      bidId: string;
      artisan_counter_price: number;
      artisan_counter_message?: string;
    }) =>
      api.post(`/bids/${bidId}/artisan-counter`, {
        artisan_counter_price,
        artisan_counter_message,
      }),
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: '🔄 Counter-proposal sent!',
        text2: 'The client will be notified.',
      });
      setNegotiationBid(null);
      qc.invalidateQueries({ queryKey: ['my-bids-artisan'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: typeof msg === 'string' ? msg : 'Could not send counter.',
      });
    },
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredBids = bids.filter((b) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'negotiating')
      return ['countered_by_client', 'artisan_countered'].includes(b.status);
    return b.status === filterStatus;
  });

  const counterCount = bids.filter((b) => b.status === 'countered_by_client').length;

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'negotiating', label: `Negotiating${counterCount > 0 ? ` (${counterCount})` : ''}` },
    { key: 'accepted', label: 'Accepted' },
    { key: 'rejected', label: 'Declined' },
  ];

  if (isLoading) {
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
        <Text className="text-white text-xl font-extrabold">My Bids</Text>
        <Text className="text-white/70 text-xs mt-0.5">
          {bids.length} bid{bids.length !== 1 ? 's' : ''} submitted
          {counterCount > 0 && (
            <Text className="text-amber-300 font-bold">
              {' '}
              · {counterCount} counter-offer{counterCount !== 1 ? 's' : ''} awaiting response
            </Text>
          )}
        </Text>

        {/* Filter tabs */}
        <View className="flex-row gap-2 mt-4 flex-wrap">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-full border ${
                filterStatus === f.key ? 'bg-white border-white' : 'border-white/30 bg-white/10'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  filterStatus === f.key ? 'text-primary' : 'text-white'
                }`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredBids}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1B5E3B" />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-4xl mb-4">📋</Text>
            <Text className="font-bold text-base text-foreground">No bids found</Text>
            <Text className="text-sm text-muted-foreground text-center mt-2 px-8">
              {filterStatus === 'all'
                ? 'Submit bids on open jobs to start negotiating!'
                : `No bids with status "${filterStatus}".`}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(artisan)/jobs')}
              className="mt-5 bg-primary px-6 py-3 rounded-2xl"
            >
              <Text className="text-white font-bold">Browse Jobs</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <BidCard bid={item} onOpenNegotiation={setNegotiationBid} onViewHistory={setHistoryBid} />
        )}
      />

      {/* Negotiation bottom sheet */}
      <NegotiationSheet
        visible={!!negotiationBid}
        bid={
          negotiationBid
            ? {
                ...negotiationBid,
                job_title: negotiationBid.job_title,
                client_name: negotiationBid.client_name,
              }
            : null
        }
        onClose={() => setNegotiationBid(null)}
        onAcceptCounter={(bidId) => acceptCounterMutation.mutate(bidId)}
        onRejectCounter={(bidId) => rejectCounterMutation.mutate(bidId)}
        onProposeMiddle={(bidId, price, msg) =>
          proposeMiddleMutation.mutate({
            bidId,
            artisan_counter_price: price,
            artisan_counter_message: msg || undefined,
          })
        }
        isAccepting={acceptCounterMutation.isPending}
        isRejecting={rejectCounterMutation.isPending}
        isProposing={proposeMiddleMutation.isPending}
      />

      {/* History modal */}
      <HistoryModal visible={!!historyBid} bid={historyBid} onClose={() => setHistoryBid(null)} />
    </View>
  );
}
