// File: mobile/app/legal/privacy.tsx
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../src/services/api';

export default function PrivacyScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['privacy'],
    queryFn: () => api.get('/legal/privacy').then((r) => r.data),
    staleTime: Infinity,
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
});
