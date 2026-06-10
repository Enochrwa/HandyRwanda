// File: mobile/app/(tabs)/messages.tsx
/**
 * Sprint 7 update — Conversations list.
 *
 * Change: last_message preview now handles voice messages gracefully:
 *   - If last message is voice-only, show "🎙️ Voice message" with mic icon
 *   - Otherwise show text content as before
 */
import { MessageCircle, Mic } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';

import { isOnAuthRoute } from '../../src/navigation';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const statusColors: Record<string, string> = {
  pending_payment:  '#F59E0B',
  confirmed:        '#3B82F6',
  artisan_accepted: '#8B5CF6',
  artisan_en_route: '#F97316',
  in_progress:      '#10B981',
  completed:        '#1B5E3B',
  cancelled:        '#9CA3AF',
  disputed:         '#EF4444',
};

const statusLabels: Record<string, string> = {
  pending_payment:  'Payment Pending',
  confirmed:        'Confirmed',
  artisan_accepted: 'Artisan Accepted',
  artisan_en_route: 'En Route',
  in_progress:      'In Progress',
  completed:        'Completed',
  cancelled:        'Cancelled',
  disputed:         'Disputed',
};

export default function ConversationsScreen() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated && !isOnAuthRoute(pathname)) router.replace('/auth');
  }, [isAuthenticated, pathname, router]);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then((r) => r.data),
    refetchInterval: 15_000,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => {
    const statusColor = statusColors[item.booking_status] ?? '#9CA3AF';
    const statusLabel = statusLabels[item.booking_status] ?? item.booking_status;
    const timeAgo = item.last_message?.created_at
      ? formatDistanceToNow(new Date(item.last_message.created_at), {
          addSuffix: true,
        })
      : '';

    const isVoicePreview = !!item.last_message?.is_voice;
    const lastContent = item.last_message?.content ?? null;

    return (
      <TouchableOpacity
        accessibilityLabel={`Chat with ${item.other_user.full_name}`}
        onPress={() => router.push(`/messages/${item.booking_id}`)}
        className="bg-card px-4 py-4 border-b border-border flex-row items-center"
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center overflow-hidden mr-3">
          {item.other_user?.avatar_url ? (
            <Image
              source={{ uri: item.other_user.avatar_url }}
              className="w-full h-full"
            />
          ) : (
            <Text className="text-primary font-extrabold text-lg">
              {item.other_user?.full_name?.[0] ?? '?'}
            </Text>
          )}
        </View>

        {/* Content */}
        <View className="flex-1 min-w-0">
          <View className="flex-row justify-between items-center mb-0.5">
            <Text className="font-bold text-foreground text-sm">
              {item.other_user?.full_name}
            </Text>
            <Text className="text-[10px] text-muted-foreground">{timeAgo}</Text>
          </View>

          {/* Last message preview — voice or text */}
          {isVoicePreview ? (
            <View className="flex-row items-center gap-1 mb-1">
              <Mic size={11} color="#6B7280" />
              <Text
                className="text-muted-foreground text-xs italic"
                numberOfLines={1}
              >
                Voice message
              </Text>
            </View>
          ) : (
            <Text
              className="text-muted-foreground text-xs mb-1"
              numberOfLines={1}
            >
              {lastContent ?? 'No messages yet'}
            </Text>
          )}

          <View className="flex-row items-center gap-2">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <Text className="text-[10px] text-muted-foreground">
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Unread badge */}
        {item.unread_count > 0 && (
          <View className="ml-2 bg-primary w-5 h-5 rounded-full items-center justify-center">
            <Text className="text-white text-[9px] font-bold">
              {item.unread_count > 9 ? '9+' : item.unread_count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card pt-14 pb-4 px-4 border-b border-border">
        <Text className="text-xl font-bold text-foreground">Messages</Text>
      </View>

      <FlatList
        data={conversations ?? []}
        keyExtractor={(item) => item.booking_id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-24 px-6">
            <View className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
              <MessageCircle size={28} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-bold text-center">
              No conversations yet
            </Text>
            <Text className="text-muted-foreground text-center text-sm mt-2">
              Book an artisan to start chatting.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/search')}
              className="mt-5 bg-primary px-6 py-3 rounded-2xl"
              accessibilityLabel="Browse artisans"
            >
              <Text className="text-white font-bold">Browse Artisans</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
