// File: mobile/app/messages/[bookingId].tsx
/**
 * Sprint 1 enhanced — Chat thread with Live Status Card
 *
 * Additions:
 *  - LiveStatusCard shown above the message list for active bookings
 *  - useBookingStatus hook for real-time WebSocket status updates
 *  - Artisan transition buttons (Accept / En Route / Arrived / Start)
 *  - ETA countdown when status is artisan_en_route
 *  - Pulsing arrival indicator when status is arrived
 */

import { Send, ChevronLeft, Phone, CheckCircle, AlertTriangle, Wifi, WifiOff } from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { isOnAuthRoute } from '../../src/navigation';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { useMessageSocket } from '../../src/hooks/useMessageSocket';
import { useBookingStatus, type BookingStatusValue } from '../../src/hooks/useBookingStatus';
import { LiveStatusCard } from '../../src/components/LiveStatusCard';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

// Status colours for the header badge
const STATUS_COLORS: Record<string, string> = {
  pending_payment:  '#F59E0B',
  confirmed:        '#3B82F6',
  artisan_accepted: '#8B5CF6',
  artisan_en_route: '#F97316',
  arrived:          '#10B981',
  in_progress:      '#059669',
  completed:        '#1B5E3B',
  cancelled:        '#6B6B6B',
  disputed:         '#EF4444',
};

// Human-readable status labels
const STATUS_LABELS: Record<string, string> = {
  pending_payment:  'Payment Pending',
  confirmed:        'Confirmed',
  artisan_accepted: 'Artisan Accepted',
  artisan_en_route: 'Artisan En Route',
  arrived:          'Artisan Arrived',
  in_progress:      'In Progress',
  completed:        'Completed',
  cancelled:        'Cancelled',
  disputed:         'Disputed',
};

// Statuses where the Live Status Card should be visible
const LIVE_STATUSES = new Set<string>([
  'confirmed',
  'artisan_accepted',
  'artisan_en_route',
  'arrived',
  'in_progress',
]);

export default function ChatThread() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // ── Socket.IO real-time messages ─────────────────────────────────────────
  const { connected: wsConnected } = useMessageSocket(bookingId);

  useEffect(() => {
    if (!isAuthenticated && !isOnAuthRoute(pathname)) router.replace('/auth');
  }, [isAuthenticated, pathname, router]);

  const { data: rawMessages = [], isLoading } = useQuery({
    queryKey: ['messages', bookingId],
    queryFn: () => api.get(`/messages/${bookingId}`).then((r) => r.data),
    refetchInterval: wsConnected ? false : 8_000,
    enabled: isAuthenticated && !!bookingId,
  });

  const { data: booking, refetch: refetchBooking } = useQuery({
    queryKey: ['booking-detail', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then((r) => r.data),
    enabled: isAuthenticated && !!bookingId,
  });

  // ── Sprint 1: Real-time booking status via WebSocket ─────────────────────
  const {
    status: liveStatus,
    etaMinutes: liveEta,
    artisanName: liveArtisanName,
  } = useBookingStatus(bookingId, booking?.status as BookingStatusValue | null);

  // Merge live WS status with API status (live takes precedence)
  const currentStatus = (liveStatus ?? booking?.status) as string | undefined;
  const currentEta = liveEta ?? booking?.eta_minutes;

  const isClient  = booking?.is_client;
  const isArtisan = user?.role === 'artisan';
  const otherUser = isClient ? booking?.artisan : booking?.client;

  const handleStatusChanged = useCallback(
    (newStatus: BookingStatusValue) => {
      qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
      qc.invalidateQueries({ queryKey: ['upcomingBookings'] });
      Toast.show({
        type: 'success',
        text1: '✅ Status updated',
        text2: STATUS_LABELS[newStatus] ?? newStatus,
      });
    },
    [qc, bookingId],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.post(`/messages/${bookingId}`, { content: text }),
    onMutate: async (newText) => {
      await qc.cancelQueries({ queryKey: ['messages', bookingId] });
      const prev = qc.getQueryData(['messages', bookingId]);
      const optimistic = {
        id: `opt-${Date.now()}`,
        sender_id: user?.id,
        content: newText,
        created_at: new Date().toISOString(),
        is_read: false,
      };
      qc.setQueryData(['messages', bookingId], (old: any) => [...(old || []), optimistic]);
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', bookingId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setContent('');
    },
    onError: (_err: any, _text: string, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['messages', bookingId], ctx.prev);
    },
  });

  const confirmPayment = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/confirm-payment`),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '💰 Payment confirmed!', text2: 'Artisan notified. 15-min accept window started.' });
      qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to confirm payment' }),
  });

  const markComplete = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/complete`),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '✅ Job completed!' });
      qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
      setTimeout(() => {
        router.push({
          pathname: '/review',
          params: {
            bookingId: bookingId as string,
            artisanName: booking?.artisan?.name ?? '',
          },
        });
      }, 800);
    },
  });

  const raiseDispute = useMutation({
    mutationFn: () =>
      api.post(`/bookings/${bookingId}/dispute`, { reason: 'Issue raised via app' }),
    onSuccess: () => {
      Toast.show({ type: 'info', text1: '⚠️ Dispute raised', text2: 'Admin will review shortly.' });
      qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
    },
  });

  const handleDispute = () => {
    Alert.alert('Raise Dispute', 'Are you sure you want to raise a dispute for this booking?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Raise Dispute', style: 'destructive', onPress: () => raiseDispute.mutate() },
    ]);
  };

  if (!isAuthenticated) return null;

  const showLiveCard = currentStatus ? LIVE_STATUSES.has(currentStatus) : false;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className="flex-1 bg-background"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View className="bg-card pt-12 pb-3 px-4 border-b border-border">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <ChevronLeft color="#1A1A1A" size={24} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-bold">{otherUser?.name ?? 'Chat'}</Text>
            {currentStatus && (
              <View className="flex-row items-center gap-1 mt-0.5">
                <View
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[currentStatus] ?? '#6B6B6B' }}
                />
                <Text className="text-xs text-muted-foreground">
                  {STATUS_LABELS[currentStatus] ?? currentStatus}
                </Text>
              </View>
            )}
          </View>

          {/* Live/offline indicator */}
          <View style={{ marginRight: 8, opacity: 0.7 }}>
            {wsConnected ? (
              <Wifi size={14} color="#1B5E3B" />
            ) : (
              <WifiOff size={14} color="#9CA3AF" />
            )}
          </View>

          {booking?.artisan?.phone_number && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${booking.artisan.phone_number}`)}
              className="p-2 bg-muted rounded-full"
            >
              <Phone size={18} color="#1B5E3B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Payment action banner — only for pending_payment */}
        {booking && currentStatus === 'pending_payment' && isClient && (
          <View className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <Text className="text-xs font-bold text-amber-800 mb-1">💰 Payment Required</Text>
            <Text className="text-xs text-amber-700 mb-2">
              Complete your payment of{' '}
              <Text className="font-bold">{formatRWF(booking.agreed_price)} RWF</Text> to confirm
              this booking.
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/payment',
                  params: { bookingId: bookingId as string, amount: String(booking.agreed_price) },
                })
              }
              className="bg-amber-500 rounded-xl py-2.5 items-center"
            >
              <Text className="text-white text-xs font-bold">Pay Now →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Artisan: confirm payment received (legacy flow) */}
        {booking && currentStatus === 'pending_payment' && !isClient && (
          <TouchableOpacity
            onPress={() => confirmPayment.mutate()}
            disabled={confirmPayment.isPending}
            className="mt-3 bg-primary rounded-xl py-2.5 items-center"
          >
            <Text className="text-white text-xs font-bold">
              {confirmPayment.isPending ? 'Confirming…' : 'Confirm Payment Received'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Client: complete / dispute (in_progress) */}
        {currentStatus === 'in_progress' && isClient && (
          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity
              onPress={() => markComplete.mutate()}
              disabled={markComplete.isPending}
              className="flex-1 bg-success rounded-xl py-2.5 items-center flex-row justify-center gap-1"
            >
              <CheckCircle size={14} color="white" />
              <Text className="text-white text-xs font-bold">Mark Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDispute}
              className="flex-1 bg-red-50 border border-red-200 rounded-xl py-2.5 items-center flex-row justify-center gap-1"
            >
              <AlertTriangle size={14} color="#EF4444" />
              <Text className="text-red-600 text-xs font-bold">Dispute</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentStatus === 'completed' && (
          <View className="mt-2 flex-row items-center gap-1.5 px-1">
            <CheckCircle size={14} color="#1B5E3B" />
            <Text className="text-xs text-success font-semibold">Job completed ✓</Text>
          </View>
        )}
      </View>

      {/* ── Live Status Card (Sprint 1) ──────────────────────────────────── */}
      {showLiveCard && bookingId && (
        <View className="px-4 pt-3">
          <LiveStatusCard
            bookingId={bookingId}
            status={currentStatus as BookingStatusValue}
            etaMinutes={currentEta}
            artisanName={
              liveArtisanName || booking?.artisan?.name || ''
            }
            isArtisan={!!isArtisan}
            onStatusChanged={handleStatusChanged}
          />
        </View>
      )}

      {/* ── Messages ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={rawMessages ?? []}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-12">
              <Text className="text-3xl mb-2">💬</Text>
              <Text className="text-muted-foreground text-sm">No messages yet. Say hello!</Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => {
            const isMe = item.sender_id === user?.id;
            return (
              <View className={`mb-3 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
                <View
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    isMe ? 'bg-primary rounded-br-sm' : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  <Text
                    className={`text-sm leading-5 ${isMe ? 'text-white' : 'text-foreground'}`}
                  >
                    {item.content}
                  </Text>
                  <Text
                    className={`text-[9px] mt-1 ${
                      isMe ? 'text-white/70' : 'text-muted-foreground'
                    }`}
                  >
                    {item.created_at ? format(new Date(item.created_at), 'HH:mm') : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      {currentStatus !== 'completed' && currentStatus !== 'cancelled' && (
        <View className="px-4 py-3 bg-card border-t border-border flex-row items-end gap-2">
          <TextInput
            className="flex-1 bg-muted px-4 py-3 rounded-2xl max-h-24 text-foreground text-sm"
            placeholder="Type a message…"
            placeholderTextColor="#9CA3AF"
            multiline
            value={content}
            onChangeText={setContent}
          />
          <TouchableOpacity
            onPress={() => {
              if (!content.trim() || sendMutation.isPending) return;
              sendMutation.mutate(content.trim());
            }}
            disabled={!content.trim() || sendMutation.isPending}
            className={`w-12 h-12 rounded-full items-center justify-center ${
              content.trim() ? 'bg-primary' : 'bg-muted'
            }`}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Send color={content.trim() ? 'white' : '#9CA3AF'} size={18} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
