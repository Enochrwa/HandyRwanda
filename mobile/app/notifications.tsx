// File: mobile/app/notifications.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import { Bell, Check, Settings } from 'lucide-react-native';
import { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

interface Notification {
  id: string;
  event_type: string;
  title: string;
  body: string;
  payload?: Record<string, string>;
  is_read: boolean;
  created_at: string;
}

function getNotifIcon(event_type: string): string {
  const map: Record<string, string> = {
    new_bid: '💼',
    bid_accepted: '✅',
    booking_confirmed: '📅',
    payment_approved: '💳',
    earnings_released: '💸',
    withdrawal_paid: '🏦',
    new_job_match: '🔔',
    job_completed: '⭐',
    review_prompt: '📝',
    dispute_resolved_win: '✅',
    dispute_resolved_loss: '❌',
    verification_approved: '🛡️',
    pro_verified: '🌟',
    new_message: '💬',
  };
  return map[event_type] ?? '📣';
}

export default function NotificationsScreen() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handlePress = useCallback(
    (notif: Notification) => {
      if (!notif.is_read) markOneRead.mutate(notif.id);
      // Deep link to the relevant screen
      const { payload } = notif;
      if (!payload) return;
      if (payload.booking_id) {
        router.push(`/messages/${payload.booking_id}`);
      } else if (payload.job_id) {
        router.push(`/(artisan)/jobs/${payload.job_id}`);
      } else if (payload.screen === 'artisan_earnings') {
        router.push('/artisan/earnings');
      }
    },
    [markOneRead, router],
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <Pressable
        onPress={() => handlePress(item)}
        style={[styles.item, !item.is_read && styles.itemUnread]}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{getNotifIcon(item.event_type)}</Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.time}>
            {item.created_at
              ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
              : ''}
          </Text>
        </View>
        {!item.is_read && <View style={styles.dot} />}
      </Pressable>
    ),
    [handlePress],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={() => markAllRead.mutate()} style={styles.markAllBtn}>
              <Check size={14} color="#1B5E3B" />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/notification-preferences')}>
            <Settings size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={notifications.length === 0 ? styles.empty : undefined}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Bell size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You'll be notified when someone bids on your job, confirms a booking, or sends a
              message.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText: { fontSize: 12, color: '#1B5E3B', fontWeight: '600' },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemUnread: { backgroundColor: '#F0FDF4' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 18 },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 14, color: '#374151', fontWeight: '500' },
  titleUnread: { fontWeight: '700', color: '#111827' },
  body: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  time: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1B5E3B',
    marginTop: 6,
    marginLeft: 8,
  },
  empty: { flex: 1 },
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 12,
  },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
