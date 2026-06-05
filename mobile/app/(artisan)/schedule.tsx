// File: mobile/app/(artisan)/schedule.tsx
/**
 * Artisan availability schedule screen.
 * Lets artisans set their weekly working hours and block specific dates.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import api from '../../src/services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface ScheduleSlot {
  day_of_week: number;
  start_time: string; // "HH:MM"
  end_time: string;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason?: string;
}

const DEFAULT_SLOTS: ScheduleSlot[] = [
  { day_of_week: 0, start_time: '08:00', end_time: '18:00' },
  { day_of_week: 1, start_time: '08:00', end_time: '18:00' },
  { day_of_week: 2, start_time: '08:00', end_time: '18:00' },
  { day_of_week: 3, start_time: '08:00', end_time: '18:00' },
  { day_of_week: 4, start_time: '08:00', end_time: '18:00' },
  { day_of_week: 5, start_time: '08:00', end_time: '13:00' },
];

export default function ArtisanScheduleScreen() {
  const qc = useQueryClient();
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5]));
  const [slots, setSlots] = useState<ScheduleSlot[]>(DEFAULT_SLOTS);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');

  const { data: schedule } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: () => api.get('/schedule/me').then((r) => r.data),
    onSuccess: (data: any) => {
      if (data.schedule?.length) {
        setSlots(
          data.schedule.map((s: any) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time.slice(0, 5),
            end_time: s.end_time.slice(0, 5),
          })),
        );
        setActiveDays(new Set(data.schedule.map((s: any) => s.day_of_week)));
      }
    },
  } as any);

  const { data: blockedDates = [] } = useQuery<BlockedDate[]>({
    queryKey: ['my-blocked-dates'],
    queryFn: () => api.get('/schedule/me').then((r) => r.data.blocked_dates),
  });

  const saveSchedule = useMutation({
    mutationFn: () =>
      api.post(
        '/schedule/slots',
        slots.filter((s) => activeDays.has(s.day_of_week)),
      ),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Schedule saved!' });
      qc.invalidateQueries({ queryKey: ['my-schedule'] });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Failed to save schedule' }),
  });

  const addBlockedDate = useMutation({
    mutationFn: () =>
      api.post('/schedule/blocked', {
        blocked_date: newBlockedDate,
        reason: newBlockedReason || undefined,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Date blocked' });
      setNewBlockedDate('');
      setNewBlockedReason('');
      qc.invalidateQueries({ queryKey: ['my-blocked-dates'] });
    },
    onError: (e: any) => Toast.show({ type: 'error', text1: e.response?.data?.detail || 'Error' }),
  });

  const removeBlockedDate = useMutation({
    mutationFn: (date: string) => api.delete(`/schedule/blocked/${date}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-blocked-dates'] }),
  });

  const toggleDay = (day: number) => {
    const next = new Set(activeDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setActiveDays(next);
  };

  const updateSlot = (day: number, field: 'start_time' | 'end_time', value: string) => {
    setSlots((prev) => {
      const existing = prev.find((s) => s.day_of_week === day);
      if (existing) return prev.map((s) => (s.day_of_week === day ? { ...s, [field]: value } : s));
      return [
        ...prev,
        { day_of_week: day, start_time: '08:00', end_time: '18:00', [field]: value },
      ];
    });
  };

  const getSlot = (day: number) =>
    slots.find((s) => s.day_of_week === day) ?? {
      day_of_week: day,
      start_time: '08:00',
      end_time: '18:00',
    };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Weekly Schedule</Text>
        <Text style={styles.sectionSub}>Set the days and hours you're available for jobs.</Text>

        <View style={styles.card}>
          {DAYS.map((day, i) => {
            const slot = getSlot(i);
            const active = activeDays.has(i);
            return (
              <View key={day} style={[styles.dayRow, i < 6 && styles.dayRowBorder]}>
                <View style={styles.dayLeft}>
                  <Switch
                    value={active}
                    onValueChange={() => toggleDay(i)}
                    trackColor={{ false: '#D1D5DB', true: '#1B5E3B' }}
                    thumbColor="#fff"
                  />
                  <Text style={[styles.dayName, !active && styles.dayNameOff]}>{day}</Text>
                </View>
                {active && (
                  <View style={styles.timeRow}>
                    <TextInput
                      style={styles.timeInput}
                      value={slot.start_time}
                      onChangeText={(v) => updateSlot(i, 'start_time', v)}
                      placeholder="08:00"
                    />
                    <Text style={styles.timeSep}>–</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={slot.end_time}
                      onChangeText={(v) => updateSlot(i, 'end_time', v)}
                      placeholder="18:00"
                    />
                  </View>
                )}
                {!active && <Text style={styles.offText}>Off</Text>}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => saveSchedule.mutate()}
          disabled={saveSchedule.isPending}
        >
          <Text style={styles.saveBtnText}>
            {saveSchedule.isPending ? 'Saving…' : 'Save Schedule'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Block Dates</Text>
        <Text style={styles.sectionSub}>
          Add dates you won't be available (holidays, personal time).
        </Text>

        <View style={styles.card}>
          <TextInput
            style={styles.inputFull}
            placeholder="Date (YYYY-MM-DD)"
            value={newBlockedDate}
            onChangeText={setNewBlockedDate}
          />
          <TextInput
            style={[styles.inputFull, { marginTop: 8 }]}
            placeholder="Reason (optional)"
            value={newBlockedReason}
            onChangeText={setNewBlockedReason}
          />
          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 10 }]}
            onPress={() => addBlockedDate.mutate()}
            disabled={!newBlockedDate || addBlockedDate.isPending}
          >
            <Text style={styles.saveBtnText}>Block This Date</Text>
          </TouchableOpacity>
        </View>

        {(blockedDates as BlockedDate[]).map((b) => (
          <View key={b.id} style={styles.blockedItem}>
            <View>
              <Text style={styles.blockedDate}>{b.blocked_date}</Text>
              {b.reason ? <Text style={styles.blockedReason}>{b.reason}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => removeBlockedDate.mutate(b.blocked_date)}>
              <Text style={styles.removeBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 8 },
  sectionSub: { fontSize: 13, color: '#6B7280' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  dayRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayName: { fontSize: 14, fontWeight: '600', color: '#111827', width: 80 },
  dayNameOff: { color: '#9CA3AF' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    width: 60,
    textAlign: 'center',
  },
  timeSep: { color: '#6B7280', fontSize: 14 },
  offText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  saveBtn: {
    backgroundColor: '#1B5E3B',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  inputFull: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  blockedDate: { fontSize: 14, fontWeight: '600', color: '#111827' },
  blockedReason: { fontSize: 12, color: '#6B7280' },
  removeBtn: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
});
