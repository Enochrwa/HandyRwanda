// File: mobile/app/(auth)/phone.tsx
// Note: This screen is used as a standalone auth entry point (separate from the main auth.tsx modal).
// It provides a simplified phone+email → OTP flow for legacy navigation paths.
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';

const RW_PHONE_RE = /^\+2507[2389]\d{7}$/;

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('+250');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!RW_PHONE_RE.test(phone)) {
      Toast.show({ type: 'error', text1: 'Invalid phone', text2: 'Format: +2507XXXXXXXX' });
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      Toast.show({ type: 'error', text1: 'Invalid email', text2: 'Enter a valid email address' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { phone_number: phone, email, lang: 'en' });
      router.push({ pathname: '/(auth)/otp', params: { email } });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message;
      Toast.show({ type: 'error', text1: 'Failed', text2: msg ?? 'Try again' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
            <Text className="text-white text-3xl font-black">H</Text>
          </View>
          <Text className="text-3xl font-extrabold text-primary">HandyRwanda</Text>
          <Text className="text-muted-foreground text-sm mt-1">Akazi beza, ku gihe</Text>
        </View>

        <Text className="text-xl font-extrabold mb-1">Get started</Text>
        <Text className="text-muted-foreground text-sm mb-6">
          Enter your phone and email to receive a sign-in code.
        </Text>

        {/* Phone */}
        <View className="mb-4">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Phone Number
          </Text>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(v.startsWith('+250') ? v : '+250' + v.replace(/^\+250/, ''))}
            placeholder="+2507XXXXXXXX"
            keyboardType="phone-pad"
            accessibilityLabel="Phone number"
            className="bg-card border border-border rounded-2xl px-4 py-3.5 text-foreground text-sm"
          />
        </View>

        {/* Email */}
        <View className="mb-6">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Email Address
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email address"
            className="bg-card border border-border rounded-2xl px-4 py-3.5 text-foreground text-sm"
          />
        </View>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={loading}
          accessibilityLabel="Continue"
          className={`bg-primary rounded-2xl py-4 items-center ${loading ? 'opacity-60' : ''}`}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-extrabold text-base">Continue →</Text>}
        </TouchableOpacity>

        <Text className="text-center text-xs text-muted-foreground mt-6 leading-5">
          By continuing you agree to our{' '}
          <Text className="text-primary font-semibold">Terms of Service</Text>
          {' '}and{' '}
          <Text className="text-primary font-semibold">Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
