// File: mobile/app/messages/[bookingId].tsx
import { Send, ChevronLeft, Phone, CheckCircle, AlertTriangle } from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
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

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

export default function ChatThread() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsMessages, setWsMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated && !isOnAuthRoute(pathname)) router.replace('/auth');
  }, [isAuthenticated, pathname, router]);

  // WebSocket — real-time messages, falls back to polling if unavailable
  useEffect(() => {
    if (!bookingId || !isAuthenticated) return;
    setWsMessages([]);

    const apiBase = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(
      /^http/,
      'ws',
    );
    const ws = new WebSocket(`${apiBase}/ws/messages/${bookingId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.sender_id !== user?.id) {
          setWsMessages((prev) => [...prev, msg]);
          qc.invalidateQueries({ queryKey: ['conversations'] });
        }
      } catch {}
    };
    ws.onerror = () => {}; // silent — polling still runs as backup
    return () => ws.close();
  }, [bookingId, isAuthenticated, user?.id, qc]);

  const { data: rawMessages = [], isLoading } = useQuery({
    queryKey: ['messages', bookingId],
    queryFn: () => api.get(`/messages/${bookingId}`).then((r) => r.data),
    refetchInterval: wsRef.current?.readyState === WebSocket.OPEN ? false : 8000,
    enabled: isAuthenticated && !!bookingId,
  });

  // Merge API messages with WebSocket-pushed messages (deduplicate by id)
  const messages = [
    ...rawMessages,
    ...wsMessages.filter((wm: any) => !rawMessages.find((m: any) => m.id === wm.id)),
  ].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const { data: booking } = useQuery({
    queryKey: ['booking-detail', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then((r) => r.data),
    enabled: isAuthenticated && !!bookingId,
  });

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
    onSuccess: (res) => {
      // Broadcast to other participant via WS
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(res.data));
      }
      qc.invalidateQueries({ queryKey: ['messages', bookingId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setContent('');
    },
    onError: (_err, _text, ctx) => {
      if (ctx?.prev) qc.setQueryData(['messages', bookingId], ctx.prev);
    },
  });

  const confirmPayment = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/confirm-payment`),
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: '💰 Payment confirmed!',
        text2: 'Artisan has been notified.',
      });
      qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to confirm payment' }),
  });

  const markComplete = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/complete`),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: '✅ Job completed!' });
      qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
      // Prompt for review — navigate after short delay so toast shows
      setTimeout(() => {
        router.push({
          pathname: '/review',
          params: {
            bookingId: bookingId as string,
            artisanName: booking?.artisan?.full_name ?? '',
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

  const isClient = booking?.is_client;
  const status = booking?.status;
  const otherUser = isClient ? booking?.artisan : booking?.client;

  const statusColors: Record<string, string> = {
    pending_payment: '#F59E0B',
    confirmed: '#3B82F6',
    in_progress: '#10B981',
    completed: '#1B5E3B',
    cancelled: '#6B6B6B',
    disputed: '#EF4444',
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="bg-card pt-12 pb-3 px-4 border-b border-border">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <ChevronLeft color="#1A1A1A" size={24} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-bold">{otherUser?.name ?? 'Chat'}</Text>
            {status && (
              <View className="flex-row items-center gap-1 mt-0.5">
                <View
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: statusColors[status] ?? '#6B6B6B' }}
                />
                <Text className="text-xs text-muted-foreground capitalize">
                  {status.replace('_', ' ')}
                </Text>
              </View>
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

        {/* Booking action banner */}
        {booking && (
          <>
            {status === 'pending_payment' && isClient && (
              <View className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <Text className="text-xs font-bold text-amber-800 mb-1">💰 Payment Required</Text>
                <Text className="text-xs text-amber-700 mb-2">
                  Complete your payment of{' '}
                  <Text className="font-bold">{formatRWF(booking.agreed_price)} RWF</Text> to
                  confirm this booking.
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/payment',
                      params: {
                        bookingId: bookingId as string,
                        amount: String(booking.agreed_price),
                      },
                    })
                  }
                  className="bg-amber-500 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-white text-xs font-bold">Pay Now →</Text>
                </TouchableOpacity>
              </View>
            )}
            {status === 'pending_payment' && !isClient && (
              <View className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => confirmPayment.mutate()}
                  disabled={confirmPayment.isPending}
                  className="flex-1 bg-primary rounded-xl py-2 items-center"
                >
                  <Text className="text-white text-xs font-bold">
                    {confirmPayment.isPending ? 'Confirming…' : 'Confirm Payment Received'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {status === 'in_progress' && isClient && (
              <View className="mt-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-2 flex-row gap-2">
                <TouchableOpacity
                  onPress={() => markComplete.mutate()}
                  disabled={markComplete.isPending}
                  className="flex-1 bg-success rounded-xl py-2 items-center flex-row justify-center gap-1"
                >
                  <CheckCircle size={14} color="white" />
                  <Text className="text-white text-xs font-bold">Mark Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDispute}
                  className="flex-1 bg-red-50 border border-red-200 rounded-xl py-2 items-center flex-row justify-center gap-1"
                >
                  <AlertTriangle size={14} color="#EF4444" />
                  <Text className="text-red-600 text-xs font-bold">Dispute</Text>
                </TouchableOpacity>
              </View>
            )}
            {status === 'completed' && (
              <View className="mt-2 flex-row items-center gap-1.5 px-1">
                <CheckCircle size={14} color="#1B5E3B" />
                <Text className="text-xs text-success font-semibold">Job completed</Text>
              </View>
            )}
          </>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-12">
              <Text className="text-3xl mb-2">💬</Text>
              <Text className="text-muted-foreground text-sm">No messages yet. Say hello!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === user?.id;
            return (
              <View className={`mb-3 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
                <View
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${isMe ? 'bg-primary rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}
                >
                  <Text className={`text-sm leading-5 ${isMe ? 'text-white' : 'text-foreground'}`}>
                    {item.content}
                  </Text>
                  <Text
                    className={`text-[9px] mt-1 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}
                  >
                    {item.created_at ? format(new Date(item.created_at), 'HH:mm') : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input bar — hide if terminated */}
      {status !== 'completed' && status !== 'cancelled' && (
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
            className={`w-12 h-12 rounded-full items-center justify-center ${content.trim() ? 'bg-primary' : 'bg-muted'}`}
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
