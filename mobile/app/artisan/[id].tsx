// File: mobile/app/artisan/[id].tsx
import { Star, MapPin, MessageCircle, ChevronLeft, Shield, Phone } from '@icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

export default function ArtisanProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [jobDesc, setJobDesc] = useState('');
  const [budget, setBudget] = useState('');
  const [when, setWhen] = useState('Tomorrow');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data: artisan, isLoading } = useQuery({
    queryKey: ['artisanPublic', id],
    queryFn: () => api.get(`/artisans/${id}/public`).then((r) => r.data),
    enabled: !!id,
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
    const conversation = conversations?.find((c: any) => c.other_user.id === id);
    if (conversation) {
      router.push(`/messages/${conversation.booking_id}`);
    } else {
      Toast.show({
        type: 'info',
        text1: 'Book first',
        text2: 'Book this artisan to start chatting',
      });
    }
  };

  const handleBook = () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    setBookingOpen(true);
    setStep(1);
    setDone(false);
    setJobDesc('');
    setBudget('');
  };

  const submitBooking = async () => {
    setSubmitting(true);
    try {
      const dateOffset: Record<string, number> = { Today: 0, Tomorrow: 1, 'This week': 3 };
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (dateOffset[when] ?? 1));
      scheduledDate.setHours(9, 0, 0, 0);

      await api
        .post('/jobs', {
          category_id: artisan?.categories?.[0]?.id ?? '00000000-0000-0000-0000-000000000000',
          title:
            jobDesc.slice(0, 100) || `${artisan?.categories?.[0]?.name_en ?? 'Service'} request`,
          description: jobDesc || 'Service request',
          latitude: -1.9441,
          longitude: 30.0619,
          location_label: user?.district ?? 'Kigali',
          scheduled_time: scheduledDate.toISOString(),
          budget: budget ? parseInt(budget, 10) : undefined,
        })
        .then(async (jobRes) => {
          // Create a direct booking with this specific artisan
          await api.post('/bookings', {
            job_id: jobRes.data.id,
            artisan_id: artisan?.id,
            agreed_price: budget
              ? parseInt(budget, 10)
              : (artisan?.profile?.hourly_rate ?? artisan?.profile?.fixed_rate ?? 5000),
          });
        });
      setStep(3);
      setDone(true);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: err?.response?.data?.detail ?? 'Try again',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1B5E3B" size="large" />
      </View>
    );
  }

  if (!artisan) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Text className="text-2xl font-bold text-center">Artisan not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary px-6 py-3 rounded-2xl"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const p = artisan.profile;
  const verBadgeColor =
    p.verification_status === 'pro_verified'
      ? '#7C3AED'
      : p.verification_status === 'id_verified'
        ? '#1B5E3B'
        : '#6B6B6B';
  const verLabel =
    p.verification_status === 'pro_verified'
      ? 'Pro Verified'
      : p.verification_status === 'id_verified'
        ? 'ID Verified'
        : 'Unverified';

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="relative h-56 bg-muted">
          {artisan.avatar_url && (
            <Image
              source={{ uri: artisan.avatar_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
          )}
          <View className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-12 left-4 w-10 h-10 bg-black/40 rounded-full items-center justify-center"
          >
            <ChevronLeft color="white" size={22} />
          </TouchableOpacity>
          {p.is_available && (
            <View className="absolute top-12 right-4 bg-green-500 px-3 py-1 rounded-full flex-row items-center gap-1">
              <View className="w-2 h-2 rounded-full bg-white" />
              <Text className="text-white text-xs font-bold">Available</Text>
            </View>
          )}
        </View>

        <View className="px-5 -mt-8">
          {/* Identity card */}
          <View className="bg-card rounded-3xl p-5 shadow-sm border border-border">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-3">
                <Text className="text-xl font-extrabold">{artisan.full_name}</Text>
                <View className="flex-row flex-wrap gap-2 mt-1.5">
                  {artisan.categories?.slice(0, 2).map((c: any) => (
                    <View key={c.id} className="bg-primary/10 px-2.5 py-0.5 rounded-full">
                      <Text className="text-primary text-xs font-bold">
                        {c.icon_emoji} {c.name_en}
                      </Text>
                    </View>
                  ))}
                  <View
                    className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: verBadgeColor + '15' }}
                  >
                    <Shield size={10} color={verBadgeColor} />
                    <Text className="text-xs font-bold" style={{ color: verBadgeColor }}>
                      {verLabel}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="bg-accent/10 px-3 py-1 rounded-full flex-row items-center">
                <Star size={14} color="#E8A020" fill="#E8A020" />
                <Text className="ml-1 text-sm font-bold text-accent">
                  {p.average_rating.toFixed(1)}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View className="flex-row gap-2 mt-4">
              {[
                { label: 'JOBS', value: p.total_reviews },
                { label: 'YRS EXP', value: p.years_experience },
                { label: 'RADIUS', value: `${p.service_radius_km}km` },
              ].map((s) => (
                <View key={s.label} className="flex-1 items-center bg-muted/50 p-3 rounded-2xl">
                  <Text className="text-primary font-extrabold text-lg">{s.value}</Text>
                  <Text className="text-[10px] text-muted-foreground">{s.label}</Text>
                </View>
              ))}
            </View>

            {artisan.district && (
              <View className="flex-row items-center mt-4">
                <MapPin size={16} color="#6B6B6B" />
                <Text className="ml-1.5 text-muted-foreground text-sm">{artisan.district}</Text>
              </View>
            )}
          </View>

          {/* About */}
          <View className="mt-5 bg-card rounded-3xl p-5 border border-border">
            <Text className="text-lg font-bold mb-2">About</Text>
            <Text className="text-muted-foreground leading-6 text-sm">
              {p.bio || 'No bio provided yet.'}
            </Text>
            {p.spoken_languages && (
              <Text className="mt-3 text-sm text-muted-foreground">
                🗣 Speaks:{' '}
                <Text className="font-semibold text-foreground">{p.spoken_languages}</Text>
              </Text>
            )}
            {p.hourly_rate && (
              <Text className="mt-2 text-sm text-muted-foreground">
                💰 Rate:{' '}
                <Text className="font-bold text-foreground">{formatRWF(p.hourly_rate)} RWF/hr</Text>
              </Text>
            )}
          </View>

          {/* Portfolio */}
          {artisan.portfolio?.length > 0 && (
            <View className="mt-5">
              <Text className="text-lg font-bold mb-3">
                Portfolio ({artisan.portfolio.length} photos)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
                {artisan.portfolio.map((p: any) => (
                  <View key={p.id} className="mr-3">
                    <Image
                      source={{ uri: p.image_url }}
                      className="w-36 h-36 rounded-2xl bg-muted"
                      resizeMode="cover"
                    />
                    {p.job_type && (
                      <Text className="text-xs text-muted-foreground mt-1 text-center">
                        {p.job_type}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Reviews */}
          {artisan.reviews?.length > 0 && (
            <View className="mt-5">
              <Text className="text-lg font-bold mb-3">Reviews ({p.total_reviews})</Text>
              {artisan.reviews.slice(0, 3).map((r: any) => (
                <View key={r.id} className="bg-card rounded-2xl p-4 mb-2 border border-border">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-semibold">{r.client_name}</Text>
                    <View className="flex-row">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          color="#E8A020"
                          fill={i < r.rating ? '#E8A020' : 'none'}
                        />
                      ))}
                    </View>
                  </View>
                  {r.comment && <Text className="text-sm text-muted-foreground">{r.comment}</Text>}
                  {r.artisan_reply && (
                    <View className="mt-2 border-l-2 border-primary pl-3">
                      <Text className="text-xs font-bold text-primary">
                        {artisan.full_name.split(' ')[0]} replied:
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        {r.artisan_reply}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          <View className="h-28" />
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3 bg-card/95 border-t border-border flex-row gap-3">
        <TouchableOpacity
          onPress={handleMessage}
          className="w-14 h-14 bg-muted rounded-2xl items-center justify-center border border-border"
        >
          <MessageCircle color="#1B5E3B" size={22} />
        </TouchableOpacity>
        {artisan.phone_number && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${artisan.phone_number}`)}
            className="w-14 h-14 bg-muted rounded-2xl items-center justify-center border border-border"
          >
            <Phone color="#1B5E3B" size={22} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleBook}
          className="flex-1 bg-accent rounded-2xl items-center justify-center h-14"
        >
          <Text className="text-white font-extrabold text-base">
            Book Now — {p.hourly_rate ? formatRWF(p.hourly_rate) + ' RWF/hr' : 'Get Quote'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Booking Modal */}
      <Modal
        visible={bookingOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBookingOpen(false)}
      >
        <View className="flex-1 bg-background p-5">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-xl font-extrabold">Book {artisan.full_name.split(' ')[0]}</Text>
            <TouchableOpacity
              onPress={() => {
                setBookingOpen(false);
                setDone(false);
              }}
              className="p-2 bg-muted rounded-full"
            >
              <Text className="font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          {done ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-5xl mb-4">🎉</Text>
              <Text className="text-2xl font-extrabold text-center">Booking sent!</Text>
              <Text className="text-muted-foreground text-center mt-2">
                {artisan.full_name.split(' ')[0]} will confirm within 2 hours.
              </Text>
              <View className="mt-5 bg-muted/30 rounded-2xl p-4 w-full border border-border">
                <Text className="text-xs font-bold text-muted-foreground mb-1">
                  PAYMENT INSTRUCTIONS
                </Text>
                <Text className="text-sm">Send payment via MoMo to:</Text>
                <Text className="text-2xl font-black text-primary mt-1">
                  {artisan.phone_number}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">Reference: HandyRwanda</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setBookingOpen(false);
                  setDone(false);
                }}
                className="mt-6 bg-primary rounded-2xl px-8 py-4 w-full items-center"
              >
                <Text className="text-white font-bold text-base">Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Progress */}
              <View className="flex-row gap-1.5 mb-6">
                {[1, 2].map((s) => (
                  <View
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </View>

              {step === 1 && (
                <View>
                  <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">
                    Describe the job
                  </Text>
                  <TextInput
                    value={jobDesc}
                    onChangeText={setJobDesc}
                    placeholder="e.g. Fix leaking pipe under kitchen sink…"
                    multiline
                    numberOfLines={4}
                    className="bg-muted/50 p-4 rounded-2xl border border-border text-sm mb-4"
                    style={{ textAlignVertical: 'top', minHeight: 100 }}
                  />
                  <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">
                    When?
                  </Text>
                  <View className="flex-row gap-2 mb-4">
                    {['Today', 'Tomorrow', 'This week'].map((w) => (
                      <TouchableOpacity
                        key={w}
                        onPress={() => setWhen(w)}
                        className={`flex-1 py-3 rounded-xl border-2 items-center ${when === w ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}
                      >
                        <Text
                          className={`text-xs font-bold ${when === w ? 'text-primary' : 'text-foreground'}`}
                        >
                          {w}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">
                    Budget (RWF) — optional
                  </Text>
                  <TextInput
                    value={budget}
                    onChangeText={setBudget}
                    placeholder={
                      p.hourly_rate ? `Suggested: ${formatRWF(p.hourly_rate)}` : 'Enter your budget'
                    }
                    keyboardType="numeric"
                    className="bg-muted/50 p-4 rounded-2xl border border-border text-sm mb-6"
                  />
                  <TouchableOpacity
                    onPress={() => setStep(2)}
                    disabled={jobDesc.trim().length < 10}
                    className={`bg-primary rounded-2xl py-4 items-center ${jobDesc.trim().length < 10 ? 'opacity-40' : ''}`}
                  >
                    <Text className="text-white font-bold">Continue →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 2 && (
                <View>
                  <Text className="text-lg font-bold mb-4">Confirm booking</Text>
                  {[
                    ['Artisan', artisan.full_name],
                    ['Job', jobDesc.length > 80 ? jobDesc.slice(0, 80) + '…' : jobDesc],
                    ['When', when],
                    ['Budget', budget ? `${formatRWF(parseInt(budget, 10))} RWF` : 'To be agreed'],
                  ].map(([label, value]) => (
                    <View
                      key={label}
                      className="flex-row justify-between bg-muted/30 rounded-xl px-4 py-3 mb-2"
                    >
                      <Text className="text-muted-foreground text-sm">{label}</Text>
                      <Text className="font-semibold text-sm text-right flex-1 ml-4">{value}</Text>
                    </View>
                  ))}
                  <View className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <Text className="text-xs font-bold text-amber-800">💡 Payment</Text>
                    <Text className="text-xs text-amber-700 mt-1">
                      After booking is confirmed, you'll send MoMo directly to the artisan's number.
                      No in-app payment needed.
                    </Text>
                  </View>
                  <View className="flex-row gap-3 mt-6">
                    <TouchableOpacity
                      onPress={() => setStep(1)}
                      className="flex-1 bg-muted rounded-2xl py-4 items-center border border-border"
                    >
                      <Text className="font-bold">Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={submitBooking}
                      disabled={submitting}
                      className="flex-2 flex-grow bg-accent rounded-2xl py-4 items-center"
                    >
                      <Text className="text-white font-extrabold">
                        {submitting ? 'Sending…' : 'Send Request ✓'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
