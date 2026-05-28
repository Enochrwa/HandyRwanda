import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function ConversationsScreen() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth');
  }, [isAuthenticated, router]);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then((r) => r.data),
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background p-4">
        {[1, 2, 3].map((i) => (
          <View key={i} className="animate-pulse bg-muted h-20 rounded-2xl mb-3" />
        ))}
      </View>
    );
  }

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      accessibilityLabel="Button"
      onPress={() => router.push(`/messages/${item.booking_id}`)}
      className="bg-card p-4 rounded-2xl mb-3 border border-border flex-row items-center"
    >
      <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
        {item.other_user.avatar_url ? (
          <Image
            source={{ uri: item.other_user.avatar_url }}
            className="w-full h-full rounded-full"
          />
        ) : (
          <Text className="text-primary font-bold text-lg">{item.other_user.full_name[0]}</Text>
        )}
      </View>
      <View className="ml-4 flex-1">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="font-bold text-foreground">{item.other_user.full_name}</Text>
          <Text className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(item.last_message.created_at), { addSuffix: true })}
          </Text>
        </View>
        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
          {item.last_message.content}
        </Text>
      </View>
      {item.unread_count > 0 && (
        <View className="ml-2 bg-destructive w-5 h-5 rounded-full items-center justify-center">
          <Text className="text-white text-[10px] font-bold">{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background p-4">
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.booking_id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View className="items-center justify-center mt-20">
            <Text className="text-muted-foreground text-center">
              No messages yet.
              {'\n'}Book an artisan to start chatting.
            </Text>
          </View>
        }
      />
    </View>
  );
}
