import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, MapPin, MessageCircle, ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function ArtisanProfile() {
  const { id } = useLocalSearchParams();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['artisanProfile', id],
    queryFn: () => api.get(`/auth/users/${id}/profile`).then((r) => r.data),
  });

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/messages/conversations').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const handleMessage = () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }

    // Find if there's a booking with this artisan
    const conversation = conversations?.find((c: any) => c.other_user.id === id);
    if (conversation) {
      router.push(`/messages/${conversation.booking_id}`);
    } else {
      Toast.show({
        type: 'info',
        text1: 'Booking required',
        text2: 'Book this artisan first to send a message',
      });
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1B5E3B" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Photo & Back Button */}
        <View className="relative h-64 bg-muted">
          {profile?.avatar_url && (
            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
          )}
          <TouchableOpacity
            accessibilityLabel="Button"
            onPress={() => router.back()}
            className="absolute top-12 left-4 w-10 h-10 bg-black/40 rounded-full items-center justify-center"
          >
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="px-6 -mt-10">
          <View className="bg-card rounded-3xl p-6 shadow-sm border border-border">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-2xl font-bold">{profile?.full_name}</Text>
                <Text className="text-muted-foreground">Certified Plumber</Text>
              </View>
              <View className="bg-accent/10 px-3 py-1 rounded-full flex-row items-center">
                <Star size={14} color="#E8A020" fill="#E8A020" />
                <Text className="ml-1 text-sm font-bold text-accent">
                  {profile?.profile?.average_rating || '5.0'}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-4 mt-6">
              <View className="flex-1 items-center bg-muted/50 p-3 rounded-2xl">
                <Text className="text-primary font-bold text-lg">
                  {profile?.profile?.years_experience || 0}
                </Text>
                <Text className="text-[10px] text-muted-foreground">YEARS EXP</Text>
              </View>
              <View className="flex-1 items-center bg-muted/50 p-3 rounded-2xl">
                <Text className="text-primary font-bold text-lg">
                  {profile?.profile?.total_reviews || 0}
                </Text>
                <Text className="text-[10px] text-muted-foreground">REVIEWS</Text>
              </View>
              <View className="flex-1 items-center bg-muted/50 p-3 rounded-2xl">
                <Text className="text-primary font-bold text-lg">
                  {profile?.profile?.community_score || 0}
                </Text>
                <Text className="text-[10px] text-muted-foreground">SCORE</Text>
              </View>
            </View>

            <View className="mt-6 border-t border-border pt-6">
              <Text className="text-lg font-bold mb-2">About</Text>
              <Text className="text-muted-foreground leading-6">
                {profile?.profile?.bio ||
                  'Expert service across Kigali with focus on quality and reliability. Always ready to help with your home maintenance needs.'}
              </Text>
            </View>

            <View className="mt-6 flex-row items-center">
              <MapPin size={18} color="#6B6B6B" />
              <Text className="ml-2 text-muted-foreground">
                {profile?.profile?.location_label || 'Gasabo, Kigali'}
              </Text>
            </View>
          </View>

          {/* Portfolio Preview */}
          <View className="mt-8">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">Work Portfolio</Text>
              <Text className="text-primary font-bold">View All</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row gap-3"
            >
              {profile?.portfolio?.length > 0
                ? profile.portfolio.map((img: any) => (
                    <Image
                      key={img.id}
                      source={{ uri: img.image_url }}
                      className="w-32 h-32 rounded-2xl bg-muted"
                    />
                  ))
                : [1, 2, 3].map((i) => <View key={i} className="w-32 h-32 rounded-2xl bg-muted" />)}
            </ScrollView>
          </View>

          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md flex-row gap-4 border-t border-border">
        <TouchableOpacity
          accessibilityLabel="Button"
          onPress={handleMessage}
          className="w-14 h-14 bg-muted rounded-2xl items-center justify-center border border-border"
        >
          <MessageCircle color="#1B5E3B" size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Button"
          className="flex-1 bg-primary rounded-2xl items-center justify-center"
        >
          <Text className="text-white font-bold text-lg">Book Service</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
