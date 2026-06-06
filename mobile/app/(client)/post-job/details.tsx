// File: mobile/app/(client)/post-job/details.tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

const URGENCY_OPTIONS = [
  { value: 'flexible', label: 'Flexible', emoji: '📅', desc: 'Within 2 weeks' },
  { value: 'this_week', label: 'This Week', emoji: '🗓️', desc: '7 days' },
  { value: 'tomorrow', label: 'Tomorrow', emoji: '⏰', desc: '24 hours' },
  { value: 'today', label: 'Today', emoji: '🔥', desc: 'Today' },
  { value: 'urgent', label: 'Urgent!', emoji: '🚨', desc: '2 hours' },
] as const;

export default function JobDetails() {
  const router = useRouter();
  const initialParams = useLocalSearchParams<{ categoryId: string }>();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialParams.categoryId ?? null,
  );

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetNegotiable, setBudgetNegotiable] = useState(true);
  const [urgency, setUrgency] = useState<string>('flexible');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission denied' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });
    if (!result.canceled && result.assets[0].uri) {
      if (photos.length >= 5) {
        Toast.show({ type: 'info', text1: 'Max 5 photos', text2: 'Remove a photo first' });
        return;
      }
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const handleNext = () => {
    if (!selectedCategoryId) {
      Toast.show({ type: 'error', text1: 'Select a service category' });
      return;
    }
    if (!title.trim() || title.length < 5) {
      Toast.show({ type: 'error', text1: 'Add a title', text2: 'At least 5 characters' });
      return;
    }
    if (!description.trim() || description.length < 15) {
      Toast.show({
        type: 'error',
        text1: 'Add more detail',
        text2: 'Describe the job clearly (15+ chars)',
      });
      return;
    }
    router.push({
      pathname: '/(client)/post-job/location',
      params: {
        categoryId: selectedCategoryId,
        title,
        description,
        additionalNotes,
        budget,
        budgetNegotiable: budgetNegotiable ? '1' : '0',
        urgency,
        photos: JSON.stringify(photos),
        scheduledTime: scheduledDate ? scheduledDate.toISOString() : '',
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* ── Fixed Header ─────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Job Details</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          Step 1 of 3 — Describe what you need
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 4 }}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: s <= 1 ? '#1B5E3B' : '#E5E7EB',
                marginRight: 4,
              }}
            />
          ))}
        </View>
      </View>

      {/* ── Scrollable body — ALL content including categories ────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Service Category */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}
        >
          Service Category <Text style={{ color: '#EF4444' }}>*</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {allCategories.map((cat: { id: string; name_en: string; icon_emoji?: string }) => {
            const selected = selectedCategoryId === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategoryId(cat.id)}
                style={{
                  width: '30%',
                  aspectRatio: 1,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: selected ? '#1B5E3B' : '#E5E7EB',
                  backgroundColor: selected ? '#F0FDF4' : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8,
                }}
              >
                <Text style={{ fontSize: 26, marginBottom: 4 }}>{cat.icon_emoji ?? '🛠️'}</Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    textAlign: 'center',
                    color: selected ? '#1B5E3B' : '#374151',
                  }}
                  numberOfLines={2}
                >
                  {cat.name_en}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Job Title <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fix leaking kitchen sink under the cabinet"
            style={{
              backgroundColor: '#fff',
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              fontSize: 14,
              color: '#111827',
            }}
            autoCapitalize="sentences"
            maxLength={200}
          />
          <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 4 }}>
            {title.length}/200
          </Text>
        </View>

        {/* Description */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Describe the Problem <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What happened? How long? What have you tried? Any special access requirements?"
            multiline
            numberOfLines={5}
            style={{
              backgroundColor: '#fff',
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              fontSize: 14,
              color: '#111827',
              textAlignVertical: 'top',
              minHeight: 120,
            }}
            autoCapitalize="sentences"
            maxLength={2000}
          />
          <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 4 }}>
            {description.length}/2000 — more detail = better bids
          </Text>
        </View>

        {/* Additional Notes */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Additional Notes{' '}
            <Text style={{ fontSize: 10, fontWeight: '400', textTransform: 'none' }}>
              (optional)
            </Text>
          </Text>
          <TextInput
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            placeholder="Materials on-site, parking info, preferred artisan qualities…"
            multiline
            numberOfLines={2}
            style={{
              backgroundColor: '#fff',
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              fontSize: 14,
              color: '#111827',
              textAlignVertical: 'top',
              minHeight: 70,
            }}
            autoCapitalize="sentences"
            maxLength={1000}
          />
        </View>

        {/* Urgency */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            How Urgent? <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {URGENCY_OPTIONS.map((u) => (
              <TouchableOpacity
                key={u.value}
                onPress={() => setUrgency(u.value)}
                accessibilityLabel={`${u.label}: ${u.desc}`}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: urgency === u.value ? '#1B5E3B' : '#E5E7EB',
                  backgroundColor: urgency === u.value ? '#F0FDF4' : '#fff',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16 }}>{u.emoji}</Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '700',
                    marginTop: 2,
                    textAlign: 'center',
                    color: urgency === u.value ? '#1B5E3B' : '#374151',
                  }}
                >
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            {URGENCY_OPTIONS.find((u) => u.value === urgency)?.desc}
          </Text>
        </View>

        {/* Scheduled Date */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Preferred Date/Time{' '}
            <Text style={{ fontSize: 10, fontWeight: '400', textTransform: 'none' }}>
              (optional)
            </Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={{
              backgroundColor: '#fff',
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 14, color: scheduledDate ? '#111827' : '#9CA3AF' }}>
              {scheduledDate
                ? scheduledDate.toLocaleString('en-RW', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Tap to pick a date and time'}
            </Text>
            <Text style={{ fontSize: 18 }}>📅</Text>
          </TouchableOpacity>
          {scheduledDate && (
            <TouchableOpacity onPress={() => setScheduledDate(null)} style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: '#EF4444' }}>Clear date</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={scheduledDate ?? new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(_: any, date: any) => {
              setShowDatePicker(false);
              if (date instanceof Date) setScheduledDate(date);
            }}
          />
        )}

        {/* Budget */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Your Budget (RWF){' '}
            <Text style={{ fontSize: 10, fontWeight: '400', textTransform: 'none' }}>
              — optional, leave blank for open bids
            </Text>
          </Text>
          <TextInput
            value={budget}
            onChangeText={setBudget}
            placeholder="e.g. 15000"
            keyboardType="numeric"
            style={{
              backgroundColor: '#fff',
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              fontSize: 14,
              color: '#111827',
            }}
          />
          {budget ? (
            <TouchableOpacity
              onPress={() => setBudgetNegotiable(!budgetNegotiable)}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: budgetNegotiable ? '#1B5E3B' : '#E5E7EB',
                  backgroundColor: budgetNegotiable ? '#1B5E3B' : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Fix 1: inline single child, no wrapping fragment */}
                {budgetNegotiable && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Open to negotiate if needed</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Photos */}
        <View style={{ marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Photos ({photos.length}/5){' '}
            <Text style={{ fontSize: 10, fontWeight: '400', textTransform: 'none' }}>
              — recommended
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {photos.map((p, i) => (
              <View key={i} style={{ position: 'relative', width: 76, height: 76 }}>
                {/* Fix 2: source and style on one line */}
                <Image source={{ uri: p }} style={{ width: 76, height: 76, borderRadius: 14 }} />
                <TouchableOpacity
                  onPress={() => setPhotos(photos.filter((_, j) => j !== i))}
                  accessibilityLabel="Remove photo"
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    backgroundColor: '#EF4444',
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity
                onPress={pickImage}
                accessibilityLabel="Add photo"
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: '#D1D5DB',
                  backgroundColor: '#F9FAFB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>📷</Text>
                <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>Add photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Fixed footer with Continue button ────────────────────────── */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: Platform.OS === 'ios' ? 32 : 20,
          paddingTop: 12,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <TouchableOpacity
          onPress={handleNext}
          accessibilityLabel="Continue to location"
          style={{
            backgroundColor: '#1B5E3B',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
            Continue → Choose Location
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
