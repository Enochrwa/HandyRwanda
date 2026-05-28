import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search, MapPin, Clock, ChevronRight, User, Briefcase } from 'lucide-react-native';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function HomeScreen() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  const { data: upcomingBookings } = useQuery({
    queryKey: ['upcomingBookings'],
    queryFn: () => api.get('/bookings/upcoming').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/artisans/categories').then((r) => r.data),
  });

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="bg-primary pt-14 pb-10 px-6 rounded-b-[40px]">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-white/80 text-sm">Location</Text>
            <View className="flex-row items-center">
              <MapPin size={14} color="white" />
              <Text className="text-white font-bold ml-1">Kigali, Rwanda</Text>
            </View>
          </View>
          <TouchableOpacity
            accessibilityLabel="Button"
            onPress={() =>
              isAuthenticated ? router.push('/(tabs)/profile') : router.push('/auth')
            }
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center overflow-hidden"
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} className="w-full h-full" />
            ) : (
              <User color="white" size={24} />
            )}
          </TouchableOpacity>
        </View>

        <Text className="text-white text-3xl font-bold">
          {isAuthenticated ? `Muraho, ${user?.fullName.split(' ')[0]} 👋` : 'Welcome 👋'}
        </Text>
        <Text className="text-white/80 mt-1">What service do you need today?</Text>

        <TouchableOpacity
          accessibilityLabel="Button"
          onPress={() => router.push('/(tabs)/search')}
          className="mt-6 flex-row items-center bg-white px-4 py-3 rounded-2xl"
        >
          <Search size={20} color="#6B6B6B" />
          <Text className="text-muted-foreground ml-3">Search for plumbers, electricians...</Text>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View className="p-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold">Services</Text>
          <TouchableOpacity
            accessibilityLabel="Button"
            onPress={() => router.push('/(tabs)/search')}
          >
            <Text className="text-primary font-bold">See All</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row flex-wrap justify-between">
          {categories?.slice(0, 4).map((cat: any) => (
            <TouchableOpacity
              accessibilityLabel="Button"
              key={cat.id}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/search',
                  params: { categoryId: cat.id },
                })
              }
              className="bg-card w-[48%] p-4 rounded-3xl border border-border mb-4 items-center"
            >
              <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center mb-2">
                <Briefcase color="#1B5E3B" size={24} />
              </View>
              <Text className="font-bold text-center">{cat.name_en || cat.name}</Text>
            </TouchableOpacity>
          )) ||
            [1, 2, 3, 4].map((i) => (
              <View
                key={i}
                className="bg-card w-[48%] h-32 rounded-3xl border border-border mb-4 animate-pulse"
              />
            ))}
        </View>
      </View>

      {/* Upcoming Booking Card */}
      <View className="px-6 pb-6">
        <Text className="text-xl font-bold mb-4">Upcoming Bookings</Text>
        {isAuthenticated ? (
          upcomingBookings?.length > 0 ? (
            upcomingBookings.map((booking: any) => (
              <TouchableOpacity
                accessibilityLabel="Button"
                key={booking.id}
                className="bg-primary/5 p-4 rounded-3xl border border-primary/20 flex-row items-center"
              >
                <View className="bg-primary/10 p-3 rounded-2xl mr-4">
                  <Clock size={24} color="#1B5E3B" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold">{booking.title}</Text>
                  <Text className="text-xs text-muted-foreground">
                    Today, 14:30 • {booking.artisan_name}
                  </Text>
                </View>
                <ChevronRight size={20} color="#1B5E3B" />
              </TouchableOpacity>
            ))
          ) : (
            <View className="bg-card p-6 rounded-3xl border border-border border-dashed items-center">
              <Text className="text-muted-foreground">No upcoming bookings</Text>
            </View>
          )
        ) : (
          <TouchableOpacity
            accessibilityLabel="Button"
            onPress={() => router.push('/auth')}
            className="bg-card p-6 rounded-3xl border border-border border-dashed items-center"
          >
            <Text className="text-muted-foreground text-center">
              Log in to see your bookings and manage your profile.
            </Text>
            <Text className="text-primary font-bold mt-2">Log in / Register</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
