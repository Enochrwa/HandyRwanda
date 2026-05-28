import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Wallet,
  Star,
  Clock,
  MapPin,
  CheckCircle,
} from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { proService } from '../../src/services/proService';
import { useAuthStore } from '../../src/store/authStore';

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <View className="bg-card p-4 rounded-3xl border border-border flex-1 mx-1 shadow-sm">
    <View
      className={`w-10 h-10 rounded-full items-center justify-center mb-2 bg-${color}/10`}
    >
      <Icon size={20} color={color} />
    </View>
    <Text className="text-muted-foreground text-xs">{title}</Text>
    <Text className="text-xl font-bold text-foreground">{value}</Text>
  </View>
);

export default function ProDashboard() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [biddingJobId, setBiddingJobId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidNote, setBidNote] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    } else if (user?.role !== 'artisan') {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, user, router]);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['proDashboard'],
    queryFn: proService.getDashboard,
    enabled: isAuthenticated && user?.role === 'artisan',
  });

  const toggleAvailability = useMutation({
    mutationFn: proService.toggleAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proDashboard'] });
      Toast.show({ type: 'success', text1: 'Status updated' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to update status' }),
  });

  const submitBid = useMutation({
    mutationFn: ({
      jobId,
      price,
      note,
    }: {
      jobId: string;
      price: number;
      note: string;
    }) => proService.submitBid(jobId, price, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proDashboard'] });
      setBiddingJobId(null);
      setBidAmount('');
      setBidNote('');
      Toast.show({ type: 'success', text1: 'Bid submitted!' });
    },
    onError: (err: any) =>
      Toast.show({
        type: 'error',
        text1: 'Failed to submit bid',
        text2: err.response?.data?.detail ?? 'Something went wrong',
      }),
  });

  if (!isAuthenticated || user?.role !== 'artisan') return null;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#1B5E3B" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              Muraho, {user?.fullName.split(' ')[0]} 👋
            </Text>
            <Text className="text-muted-foreground">Manage your business</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs font-bold mb-1">Available</Text>
            <Switch
              value={dashboard?.is_available ?? false}
              onValueChange={(val) => toggleAvailability.mutate(val)}
              trackColor={{ false: '#E2E8F0', true: '#1B5E3B' }}
            />
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row mb-6">
          <StatCard
            title="Earnings"
            value={`${dashboard?.earnings_this_month?.toLocaleString() ?? 0} RWF`}
            icon={Wallet}
            color="#1B5E3B"
          />
          <StatCard
            title="Jobs Done"
            value={dashboard?.jobs_count ?? 0}
            icon={CheckCircle}
            color="#1565C0"
          />
          <StatCard
            title="Rating"
            value={dashboard?.avg_rating?.toFixed(1) ?? '0.0'}
            icon={Star}
            color="#E8A020"
          />
        </View>

        {/* Schedule */}
        <View className="mb-6">
          <Text className="text-lg font-bold mb-3">Today's Schedule</Text>
          {dashboard?.schedule?.length > 0 ? (
            dashboard.schedule.map((item: any) => (
              <View
                key={item.id}
                className="bg-card p-4 rounded-2xl border border-border mb-3 flex-row items-center"
              >
                <View className="bg-primary/10 p-2 rounded-xl mr-4">
                  <Clock size={20} color="#1B5E3B" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold">{item.title}</Text>
                  <Text className="text-xs text-muted-foreground">
                    {item.client_name} •{' '}
                    {new Date(item.time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View className="bg-success/10 px-2 py-1 rounded-lg">
                  <Text className="text-success text-[10px] font-bold">
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-card p-8 rounded-2xl border border-border border-dashed items-center">
              <Text className="text-muted-foreground">No bookings today</Text>
            </View>
          )}
        </View>

        {/* Nearby Jobs */}
        <View className="mb-10">
          <Text className="text-lg font-bold mb-3">Nearby Jobs for You</Text>
          {dashboard?.nearby_jobs?.length > 0 ? (
            dashboard.nearby_jobs.map((job: any) => (
              <View
                key={job.id}
                className="bg-card p-4 rounded-2xl border border-border mb-4"
              >
                <View className="flex-row justify-between mb-2">
                  <Text className="font-bold text-lg flex-1">{job.title}</Text>
                  <Text className="text-primary font-bold">
                    {job.budget?.toLocaleString() ?? 'Negotiable'} RWF
                  </Text>
                </View>
                <View className="flex-row items-center mb-3">
                  <MapPin size={14} color="#6B6B6B" />
                  <Text className="text-xs text-muted-foreground ml-1">
                    {job.location_label} • {job.distance} km away
                  </Text>
                </View>
                <Text className="text-sm text-foreground mb-4" numberOfLines={2}>
                  {job.description}
                </Text>

                {biddingJobId === job.id ? (
                  <View className="bg-muted p-4 rounded-xl">
                    <Text className="font-bold mb-2">Submit Bid</Text>
                    <TextInput
                      className="bg-card p-3 rounded-lg border border-border mb-2"
                      placeholder="Your Price (RWF)"
                      keyboardType="numeric"
                      value={bidAmount}
                      onChangeText={setBidAmount}
                    />
                    <TextInput
                      className="bg-card p-3 rounded-lg border border-border mb-4 h-20 text-start"
                      placeholder="Add a note (experience, tools, etc.)"
                      multiline
                      value={bidNote}
                      onChangeText={setBidNote}
                    />
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        accessibilityLabel="Button"
                        onPress={() => setBiddingJobId(null)}
                        className="flex-1 p-3 rounded-xl border border-border items-center"
                      >
                        <Text className="font-bold">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel="Button"
                        onPress={() =>
                          submitBid.mutate({
                            jobId: job.id,
                            price: parseInt(bidAmount),
                            note: bidNote,
                          })
                        }
                        disabled={submitBid.isPending}
                        className="flex-1 bg-primary p-3 rounded-xl items-center"
                      >
                        {submitBid.isPending ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text className="text-white font-bold">Send Bid</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    accessibilityLabel="Button"
                    onPress={() => {
                      setBiddingJobId(job.id);
                      setBidAmount(job.budget?.toString() ?? '');
                    }}
                    className="bg-primary p-3 rounded-xl items-center"
                  >
                    <Text className="text-white font-bold">Bid on Job</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View className="bg-card p-8 rounded-2xl border border-border border-dashed items-center">
              <Text className="text-muted-foreground">No new jobs nearby</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
