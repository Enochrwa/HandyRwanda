import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Send, ChevronLeft } from 'lucide-react-native';
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
} from 'react-native';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function ChatThread() {
  const { bookingId } = useLocalSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth');
  }, [isAuthenticated, router]);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', bookingId],
    queryFn: () => api.get(`/messages/${bookingId}`).then((r) => r.data),
    refetchInterval: 8000,
    enabled: isAuthenticated && !!bookingId,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.post(`/messages/${bookingId}`, { content: text }),
    onMutate: async (newText) => {
      await queryClient.cancelQueries({ queryKey: ['messages', bookingId] });
      const previousMessages = queryClient.getQueryData(['messages', bookingId]);

      const optimisticMessage = {
        id: Date.now().toString(),
        sender_id: user?.id,
        content: newText,
        created_at: new Date().toISOString(),
        is_read: false,
      };

      queryClient.setQueryData(['messages', bookingId], (old: any) => [
        ...(old || []),
        optimisticMessage,
      ]);

      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', bookingId] });
      setContent('');
    },
    onError: (_err, newText, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', bookingId], context.previousMessages);
      }
    },
  });

  const handleSend = () => {
    if (!content.trim() || sendMutation.isPending) return;
    sendMutation.mutate(content.trim());
  };

  if (!isAuthenticated) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="bg-card p-4 pt-12 border-b border-border flex-row items-center">
        <TouchableOpacity
          accessibilityLabel="Button"
          onPress={() => router.back()}
          className="mr-4"
        >
          <ChevronLeft color="#1A1A1A" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-bold">Chat Thread</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.sender_id === user?.id;
            return (
              <View className={`mb-4 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
                <View
                  className={`max-w-[80%] p-3 rounded-2xl ${isMe ? 'bg-primary rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}
                >
                  <Text className={isMe ? 'text-white' : 'text-foreground'}>{item.content}</Text>
                  <Text
                    className={`text-[8px] mt-1 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}
                  >
                    {format(new Date(item.created_at), 'HH:mm')}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input Bar */}
      <View className="p-4 bg-card border-t border-border flex-row items-center gap-2">
        <TextInput
          className="flex-1 bg-muted p-3 rounded-2xl max-h-24 text-foreground"
          placeholder="Type a message..."
          multiline
          value={content}
          onChangeText={setContent}
        />
        <TouchableOpacity
          accessibilityLabel="Button"
          onPress={handleSend}
          disabled={!content.trim() || sendMutation.isPending}
          className={`w-12 h-12 rounded-full items-center justify-center ${content.trim() ? 'bg-primary' : 'bg-muted'}`}
        >
          <Send color={content.trim() ? 'white' : '#6B6B6B'} size={20} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
