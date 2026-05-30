/**
 * HandyRwanda — Onboarding / Welcome screen
 *
 * Shown once on first launch. Explains the app, lets the user choose
 * "I need a service" (client) or "I offer services" (artisan), then
 * drops them into the home tab or the auth flow.
 *
 * Persists a `hr_onboarded` key in AsyncStorage so it only shows once.
 */

import { Briefcase, CheckCircle, MapPin, Shield, Star, Wrench, Zap } from '@icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ── Slide content ────────────────────────────────────────────────────────────

const slides = [
  {
    id: '1',
    emoji: '🔧',
    title: "Rwanda's",
    subtitle:
      'Find trusted plumbers, electricians, cleaners, carpenters and more — right in your district. Booked in minutes.',
    color: '#1B5E3B',
    icon: Wrench,
    highlights: ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting'],
  },
  {
    id: '2',
    emoji: '🛡️',
    title: 'Verified & Background-Checked',
    subtitle:
      'Every artisan on HandyRwanda is ID-verified, skill-tested, and rated by real customers. No middlemen, no scams.',
    color: '#1B5E3B',
    icon: Shield,
    highlights: ['ID Verified', 'Skill Tested', 'Real Reviews', 'Insured Work'],
  },
  {
    id: '3',
    emoji: '💰',
    title: 'Pay Safely with MoMo',
    subtitle:
      'Your payment is held securely until the job is done. Pay with MTN MoMo or Airtel Money. Rate the work, then release funds.',
    color: '#1B5E3B',
    icon: Zap,
    highlights: ['MTN MoMo', 'Airtel Money', 'Held Until Done', 'Money-back Guarantee'],
  },
  {
    id: '4',
    emoji: '📍',
    title: 'Covering All of Rwanda',
    subtitle:
      'From Kigali to Musanze, Huye to Rubavu — find qualified artisans in every district, with live map tracking.',
    color: '#1B5E3B',
    icon: MapPin,
    highlights: ['Kigali', 'Northern Province', 'Southern Province', 'Eastern & Western'],
  },
];

// ── Slide component ──────────────────────────────────────────────────────────

function Slide({ item }: { item: (typeof slides)[0] }) {
  return (
    <View style={{ width }} className="flex-1 px-8 pt-8 pb-4 items-center">
      {/* Big emoji / icon badge */}
      <View
        className="w-28 h-28 rounded-full items-center justify-center mb-8"
        style={{ backgroundColor: '#1B5E3B' }}
      >
        <Text style={{ fontSize: 48 }}>{item.emoji}</Text>
      </View>

      <Text className="text-3xl font-extrabold text-center text-foreground leading-tight mb-4">
        {item.title}
      </Text>
      <Text className="text-base text-center text-muted-foreground leading-relaxed mb-8">
        {item.subtitle}
      </Text>

      {/* Feature chips */}
      <View className="flex-row flex-wrap justify-center gap-2">
        {item.highlights.map((h) => (
          <View key={h} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full">
            <CheckCircle size={12} color="#1B5E3B" />
            <Text className="ml-1.5 text-xs font-semibold text-primary">{h}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Dot indicators ───────────────────────────────────────────────────────────

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View className="flex-row justify-center gap-2 py-4">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === active ? '#1B5E3B' : '#CBD5E1',
          }}
        />
      ))}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const isLast = activeIndex === slides.length - 1;

  const markDoneAndNavigate = async (path: string) => {
    await AsyncStorage.setItem('hr_onboarded', '1');
    router.replace(path as any);
  };

  const handleNext = () => {
    if (isLast) return; // handled by CTA buttons
    const next = activeIndex + 1;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  };

  const handleSkip = () => markDoneAndNavigate('/(tabs)');

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Skip button */}
      <View className="flex-row justify-end px-6 pt-4">
        {!isLast && (
          <TouchableOpacity accessibilityLabel="Skip onboarding" onPress={handleSkip}>
            <Text className="text-muted-foreground font-semibold text-sm">Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isLast}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => <Slide item={item} />}
        className="flex-1"
      />

      {/* Dots */}
      <Dots count={slides.length} active={activeIndex} />

      {/* CTA */}
      <View className="px-6 pb-8 gap-3">
        {isLast ? (
          <>
            {/* Primary: I need a service */}
            <TouchableOpacity
              accessibilityLabel="I need a service"
              onPress={() => markDoneAndNavigate('/auth')}
              className="bg-primary py-4 rounded-2xl flex-row items-center justify-center gap-3"
            >
              <Star size={20} color="white" />
              <Text className="text-white font-bold text-base">I Need a Service</Text>
            </TouchableOpacity>

            {/* Secondary: I'm an artisan */}
            <TouchableOpacity
              accessibilityLabel="I offer services as an artisan"
              onPress={() => markDoneAndNavigate('/auth')}
              className="border-2 border-primary py-4 rounded-2xl flex-row items-center justify-center gap-3"
            >
              <Briefcase size={20} color="#1B5E3B" />
              <Text className="text-primary font-bold text-base">I Offer Services (Artisan)</Text>
            </TouchableOpacity>

            {/* Ghost: Browse without signing in */}
            <TouchableOpacity
              accessibilityLabel="Browse without signing in"
              onPress={() => markDoneAndNavigate('/(tabs)')}
            >
              <Text className="text-center text-muted-foreground text-sm mt-1">
                Browse without signing in →
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            accessibilityLabel="Next slide"
            onPress={handleNext}
            className="bg-primary py-4 rounded-2xl items-center"
          >
            <Text className="text-white font-bold text-base">Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
