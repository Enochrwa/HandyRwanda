// File: mobile/app/legal/terms.tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function TermsScreen() {
  const { isAuthenticated } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['terms'],
    queryFn: () => api.get('/legal/terms').then((r) => r.data),
    staleTime: Infinity,
  });

  const accept = useMutation({
    mutationFn: () => api.post('/legal/accept'),
    onSuccess: () => Toast.show({ type: 'success', text1: 'Terms accepted!' }),
    onError: () => Toast.show({ type: 'error', text1: 'Failed to accept terms' }),
  });

  if (isLoading)
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{data?.title}</Text>
        <Text style={styles.meta}>
          Version {data?.version} · {data?.last_updated}
        </Text>
        {(data?.sections ?? []).map((s: any) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => accept.mutate()}
            disabled={accept.isPending}
          >
            <Text style={styles.btnText}>
              {accept.isPending ? 'Saving…' : 'I Accept These Terms'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  meta: { fontSize: 12, color: '#9CA3AF' },
  section: { gap: 6 },
  heading: { fontSize: 15, fontWeight: '700', color: '#374151' },
  body: { fontSize: 14, color: '#6B7280', lineHeight: 22 },
  btn: {
    backgroundColor: '#1B5E3B',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
