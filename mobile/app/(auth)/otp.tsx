// File: mobile/app/(auth)/otp.tsx
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function OTPScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    // Auto-focus input
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    if (otp.length < 6) {
      Toast.show({ type: 'error', text1: 'Invalid code', text2: 'Enter the 6-digit code' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/otp/verify', { email, otp_code: otp });
      const { access_token, refresh_token, user } = data;
      setAuth(
        {
          id: user.id,
          fullName: user.full_name,
          phone: user.phone_number,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatar_url ?? undefined,
          // Full Rwanda address
          province: user.province ?? null,
          district: user.district ?? null,
          sector: user.sector ?? null,
          cell: user.cell ?? null,
          village: user.village ?? null,
          streetRoad: user.street_road ?? null,
          houseNumber: user.house_number ?? null,
          landmark: user.landmark ?? null,
          addressDetail: user.address_detail ?? null,
          preferredLang: user.preferred_lang ?? 'rw',
          accountStatus: user.account_status,
          emailVerified: user.email_verified ?? true,
        },
        access_token,
        refresh_token,
      );
      Toast.show({ type: 'success', text1: `Welcome, ${user.full_name.split(' ')[0]}! 👋` });
      // Redirect based on role
      if (user.role === 'artisan') {
        router.replace('/(tabs)/pro');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message;
      Toast.show({
        type: 'error',
        text1: 'Invalid code',
        text2: msg ?? 'Code expired or wrong. Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await api.post('/auth/otp/request', { email, lang: 'en' });
      setCooldown(60);
      Toast.show({ type: 'success', text1: 'Code resent!', text2: `Check ${email}` });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to resend' });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <View className="flex-1 px-6 justify-center">
        {/* Icon */}
        <View className="w-20 h-20 rounded-3xl bg-primary/10 items-center justify-center mx-auto mb-6">
          <Text style={{ fontSize: 36 }}>✉️</Text>
        </View>

        <Text className="text-3xl font-extrabold text-center text-foreground mb-2">
          Check your email
        </Text>
        <Text className="text-sm text-muted-foreground text-center mb-8">
          We sent a 6-digit code to{'\n'}
          <Text className="font-bold text-foreground">{email}</Text>
        </Text>

        {/* OTP input */}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(v) => {
            setOtp(v.replace(/\D/g, '').slice(0, 6));
          }}
          onSubmitEditing={handleVerify}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          className="bg-card border-2 border-primary rounded-2xl text-center text-foreground mb-6"
          style={{ fontSize: 36, letterSpacing: 12, paddingVertical: 20, fontWeight: '800' }}
          autoFocus
        />

        {/* Verify button */}
        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading || otp.length < 6}
          accessibilityLabel="Verify code"
          className={`bg-primary rounded-2xl py-4 items-center mb-4 ${loading || otp.length < 6 ? 'opacity-50' : ''}`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-extrabold text-base">Verify Code →</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          onPress={handleResend}
          disabled={cooldown > 0}
          accessibilityLabel="Resend code"
          className="items-center py-3"
        >
          <Text
            className={`text-sm font-semibold ${cooldown > 0 ? 'text-muted-foreground' : 'text-primary'}`}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get the code? Resend"}
          </Text>
        </TouchableOpacity>

        {/* Back */}
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="items-center py-2 mt-1"
        >
          <Text className="text-xs text-muted-foreground">← Wrong email? Go back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
