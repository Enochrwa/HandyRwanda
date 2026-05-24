import { useRouter } from 'expo-router';
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
import api from '../../services/api';
import { colors, typography, spacing, radius } from '../../src/theme';

export default function PhoneScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOTP = async () => {
    if (!phoneNumber || !email) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    // Rwanda format validation: +2507XXXXXXXX
    const rwandaPhoneRegex = /^\+2507[2389][0-9]{7}$/;
    if (!rwandaPhoneRegex.test(phoneNumber)) {
      Alert.alert('Error', 'Invalid Rwanda phone number format (+2507XXXXXXXX)');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/otp/request', {
        phone_number: phoneNumber,
        email,
        lang: i18n.locale,
      });
      router.push({ pathname: '/(auth)/otp', params: { email } });
    } catch (error) {
      Alert.alert('Error', 'Failed to request OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>HandyRwanda</Text>
      <Text style={styles.subtitle}>Enter your details to get started</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{i18n.t('auth.phone_label')}</Text>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('auth.phone_placeholder')}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{i18n.t('auth.email_label')}</Text>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleRequestOTP} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>{i18n.t('auth.request_otp')}</Text>
        )}
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
    ...typography.display,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...typography.body,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: {
    ...typography.subheading,
    color: colors.surface,
  },
});
