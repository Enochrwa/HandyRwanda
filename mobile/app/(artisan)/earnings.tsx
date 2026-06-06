// File: mobile/app/(artisan)/earnings.tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';

export default function ArtisanEarningsScreen() {
  const [momoNumber, setMomoNumber] = useState('');
  const [amount, setAmount] = useState('');

  const {
    data: summary,
    isLoading: loadingSummary,
    refetch,
  } = useQuery({
    queryKey: ['artisan-earnings'],
    queryFn: () => api.get('/escrow/earnings').then((r) => r.data),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['artisan-transactions'],
    queryFn: () => api.get('/escrow/transactions').then((r) => r.data),
  });

  const { data: withdrawals = [], refetch: refetchWithdrawals } = useQuery({
    queryKey: ['artisan-withdrawals'],
    queryFn: () => api.get('/escrow/withdrawals').then((r) => r.data),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      api.post('/escrow/withdraw', { amount: parseInt(amount, 10), momo_number: momoNumber }),
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: 'Withdrawal submitted!',
        text2: 'Admin will process within 24 hours.',
      });
      setAmount('');
      setMomoNumber('');
      refetch();
      refetchWithdrawals();
    },
    onError: (e: any) =>
      Toast.show({ type: 'error', text1: e.response?.data?.detail || 'Withdrawal failed' }),
  });

  const statusColor = (s: string) =>
    ({ held: '#F59E0B', released: '#10B981', refunded: '#EF4444', disputed: '#F97316' })[s] ??
    '#6B7280';
  const withdrawStatusColor = (s: string) =>
    ({ pending: '#F59E0B', processing: '#3B82F6', paid: '#10B981', rejected: '#EF4444' })[s] ??
    '#6B7280';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loadingSummary} onRefresh={refetch} />}
      >
        {/* Summary Cards */}
        <View style={styles.grid}>
          {[
            { label: 'Available', value: summary?.available_for_withdrawal ?? 0, color: '#10B981' },
            { label: 'Pending Release', value: summary?.pending_release ?? 0, color: '#F59E0B' },
            { label: 'Pending Payout', value: summary?.pending_withdrawal ?? 0, color: '#3B82F6' },
            { label: 'Total Earned', value: summary?.total_earned ?? 0, color: '#111827' },
          ].map((item) => (
            <View key={item.label} style={styles.card}>
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Text style={[styles.cardValue, { color: item.color }]}>
                {(item.value as number).toLocaleString()}
              </Text>
              <Text style={styles.cardCurrency}>RWF</Text>
            </View>
          ))}
        </View>

        {/* Withdrawal Request */}
        {(summary?.available_for_withdrawal ?? 0) >= 1000 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Request Payout</Text>
            <TextInput
              style={styles.input}
              placeholder="MTN / Airtel number (07XXXXXXXX)"
              value={momoNumber}
              onChangeText={setMomoNumber}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder={`Amount in RWF (max ${(summary?.available_for_withdrawal ?? 0).toLocaleString()})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.btn, (!momoNumber || !amount) && styles.btnDisabled]}
              onPress={() => withdraw.mutate()}
              disabled={!momoNumber || !amount || withdraw.isPending}
            >
              <Text style={styles.btnText}>
                {withdraw.isPending ? 'Submitting…' : 'Request Payout'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {(transactions as any[]).length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet</Text>
          ) : (
            (transactions as any[]).slice(0, 20).map((t: any) => (
              <View key={t.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemAmount}>{t.amount.toLocaleString()} RWF</Text>
                  <Text style={styles.itemMeta}>
                    {t.held_at ? formatDistanceToNow(new Date(t.held_at), { addSuffix: true }) : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusColor(t.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor(t.status) }]}>
                    {t.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Withdrawal History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout History</Text>
          {(withdrawals as any[]).length === 0 ? (
            <Text style={styles.emptyText}>No payouts yet</Text>
          ) : (
            (withdrawals as any[]).map((w: any) => (
              <View key={w.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemAmount}>
                    {w.amount.toLocaleString()} RWF → {w.momo_number}
                  </Text>
                  {w.admin_note && <Text style={styles.itemNote}>{w.admin_note}</Text>}
                  <Text style={styles.itemMeta}>
                    {w.created_at
                      ? formatDistanceToNow(new Date(w.created_at), { addSuffix: true })
                      : ''}
                  </Text>
                </View>
                <View
                  style={[styles.badge, { backgroundColor: withdrawStatusColor(w.status) + '20' }]}
                >
                  <Text style={[styles.badgeText, { color: withdrawStatusColor(w.status) }]}>
                    {w.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  cardLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  cardCurrency: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
  },
  btn: {
    backgroundColor: '#1B5E3B',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  itemAmount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  itemNote: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
});
