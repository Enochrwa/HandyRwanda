import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

import i18n from '../../i18n';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { colors, typography, spacing, radius } from '../../src/theme';

export default function OTPScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/otp/verify', {
        email,
        otp_code: otp,
      });

      const { access_token, refresh_token, user } = response.data;
      await setAuth(user, access_token, refresh_token);

      // In a real flow, check if user.full_name is "New User" and redirect to registration/onboarding
      router.replace('/(client)/home');
    } catch {
      Alert.alert('Error', 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{i18n.t('auth.otp_title')}</Text>
      <Text style={styles.subtitle}>Sent to {email}</Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />

      <TouchableOpacity style={styles.button} onPress={handleVerifyOTP} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>{i18n.t('auth.verify')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          api.post('/auth/otp/request', { email, lang: i18n.locale, phone_number: 'existing' })
        }
        style={styles.resendButton}
      >
        <Text style={styles.resendText}>{i18n.t('auth.resend')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  title: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...typography.display,
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.subheading,
    color: colors.surface,
  },
  resendButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  resendText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
