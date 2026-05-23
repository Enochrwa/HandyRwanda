import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radius } from '../../../src/theme';

export default function BidSentSuccess() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>Bid Sent!</Text>
      <Text style={styles.subtitle}>We'll notify you when the client responds to your offer.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(artisan)/home')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: { fontSize: 64, marginBottom: spacing.lg },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  button: { backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md },
  buttonText: { ...typography.subheading, color: colors.surface },
});
