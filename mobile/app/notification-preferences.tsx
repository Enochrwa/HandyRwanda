// File: mobile/app/notification-preferences.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import api from '../src/services/api';

interface Prefs {
  new_bid: boolean;
  booking_update: boolean;
  payment: boolean;
  message: boolean;
  promo: boolean;
}

const PREF_LABELS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: 'new_bid', label: 'New bids', desc: 'When an artisan bids on your job' },
  { key: 'booking_update', label: 'Booking updates', desc: 'Confirmations, completions, and status changes' },
  { key: 'payment', label: 'Payments & earnings', desc: 'Payment approvals, escrow releases, withdrawals' },
  { key: 'message', label: 'Messages', desc: 'When you receive a new message' },
  { key: 'promo', label: 'Promotions', desc: 'Tips, offers, and HandyRwanda news' },
];

export default function NotificationPreferencesScreen() {
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>({
    new_bid: true, booking_update: true, payment: true, message: true, promo: false,
  });

  const { data: serverPrefs } = useQuery<Prefs>({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get('/notifications/preferences').then((r) => r.data),
  });

  useEffect(() => {
    if (serverPrefs) setPrefs(serverPrefs);
  }, [serverPrefs]);

  const save = useMutation({
    mutationFn: (updated: Prefs) => api.patch('/notifications/preferences', updated),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] });
      Toast.show({ type: 'success', text1: 'Preferences saved' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to save preferences' }),
  });

  const toggle = (key: keyof Prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    save.mutate(updated);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Notification Preferences</Text>
        <Text style={styles.subheading}>Choose what notifications you receive.</Text>

        <View style={styles.card}>
          {PREF_LABELS.map((item, i) => (
            <View key={item.key} style={[styles.row, i < PREF_LABELS.length - 1 && styles.rowBorder]}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDesc}>{item.desc}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: '#D1D5DB', true: '#1B5E3B' }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subheading: { fontSize: 14, color: '#6B7280' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
});
