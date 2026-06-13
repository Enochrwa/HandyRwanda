// File: mobile/app/(client)/post-job/details.tsx
// Sprint 9 — AI Job Description Assistant integrated
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
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

const PRIMARY = '#1B5E3B';
const PRIMARY_LIGHT = '#F0FDF4';
const BORDER = '#E5E7EB';
const TEXT_MAIN = '#111827';
const TEXT_MUTED = '#6B7280';
const TEXT_LABEL = '#9CA3AF';

type AiSuggestion = {
  suggested_category: { id: string; name_en: string; emoji: string } | null;
  confidence: number;
  related_suggestions: string[];
  typical_price_range: {
    min: number;
    max: number;
    currency: string;
    based_on?: number;
  } | null;
  source: string;
};

function formatRWF(amount: number): string {
  return new Intl.NumberFormat('en-RW').format(amount);
}

// ── AI Suggestion Panel ────────────────────────────────────────────────────────
function AiSuggestionPanel({
  suggestion,
  loading,
  onApplyCategory,
  onApplyBudget,
}: {
  suggestion: AiSuggestion | null;
  loading: boolean;
  onApplyCategory: (id: string, name: string) => void;
  onApplyBudget: (amount: number) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (suggestion || loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [suggestion, loading, fadeAnim]);

  if (!suggestion && !loading) return null;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        marginTop: 10,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 14,
        padding: 14,
        gap: 10,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 14 }}>✨</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY }}>AI Assistant</Text>
        {loading && <ActivityIndicator size="small" color={PRIMARY} style={{ marginLeft: 4 }} />}
        {suggestion?.source === 'sklearn' && (
          <View
            style={{
              marginLeft: 'auto',
              backgroundColor: '#D1FAE5',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 9, color: PRIMARY, fontWeight: '600' }}>sklearn TF-IDF</Text>
          </View>
        )}
      </View>

      {/* Category suggestion */}
      {suggestion?.suggested_category && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 10,
          }}
        >
          <Text style={{ fontSize: 22, marginRight: 10 }}>
            {suggestion.suggested_category.emoji}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_MAIN }}>
              {suggestion.suggested_category.name_en}
            </Text>
            <Text style={{ fontSize: 10, color: TEXT_MUTED }}>
              {Math.round(suggestion.confidence * 100)}% confidence
            </Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              suggestion.suggested_category &&
              onApplyCategory(
                suggestion.suggested_category.id,
                suggestion.suggested_category.name_en,
              )
            }
            style={{
              backgroundColor: PRIMARY,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Apply →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Price range */}
      {suggestion?.typical_price_range && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14 }}>📈</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: TEXT_MAIN }}>
              <Text style={{ fontWeight: '700' }}>
                {formatRWF(suggestion.typical_price_range.min)} –{' '}
                {formatRWF(suggestion.typical_price_range.max)} RWF
              </Text>
              {suggestion.typical_price_range.based_on ? (
                <Text style={{ color: TEXT_MUTED }}>
                  {' '}
                  ({suggestion.typical_price_range.based_on} completed jobs)
                </Text>
              ) : null}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (suggestion.typical_price_range) {
                const mid = Math.round(
                  (suggestion.typical_price_range.min + suggestion.typical_price_range.max) / 2,
                );
                onApplyBudget(mid);
              }
            }}
            style={{
              backgroundColor: '#D1FAE5',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: PRIMARY, fontSize: 10, fontWeight: '700' }}>Use</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tips */}
      {suggestion?.related_suggestions && suggestion.related_suggestions.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: TEXT_LABEL,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Improve your description:
          </Text>
          {suggestion.related_suggestions.map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 13, marginTop: -1 }}>💡</Text>
              <Text style={{ fontSize: 12, color: TEXT_MUTED, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
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

  // Sprint 12 — Recurring job state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>(
    'weekly',
  );
  const [recurringDayOfWeek, setRecurringDayOfWeek] = useState<number>(5); // Saturday
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState<number>(1);
  const [recurringPreferSameArtisan, setRecurringPreferSameArtisan] = useState(true);

  // Sprint 9 — AI state
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch AI suggestion with debounce
  const fetchSuggestion = useCallback(async (text: string) => {
    if (!text || text.trim().length < 10) {
      setAiSuggestion(null);
      return;
    }
    setAiLoading(true);
    try {
      const { data } = await api.post('/jobs/suggest', {
        partial_description: text,
      });
      setAiSuggestion(data as AiSuggestion);
    } catch {
      // Silent fail — AI is an enhancement, not critical path
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestion(text), 800);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
        // Sprint 12: recurring params
        isRecurring: isRecurring ? '1' : '0',
        recurringFrequency,
        recurringDayOfWeek: String(recurringDayOfWeek),
        recurringDayOfMonth: String(recurringDayOfMonth),
        recurringPreferSameArtisan: recurringPreferSameArtisan ? '1' : '0',
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* ── Fixed Header ──────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: TEXT_MAIN }}>Job Details</Text>
        <Text style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>
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
                backgroundColor: s <= 1 ? PRIMARY : BORDER,
                marginRight: 4,
              }}
            />
          ))}
        </View>
      </View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
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
            color: TEXT_LABEL,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}
        >
          Service Category <Text style={{ color: '#EF4444' }}>*</Text>
        </Text>
        {/* AI category suggestion banner */}
        {aiSuggestion?.suggested_category && !selectedCategoryId && (
          <TouchableOpacity
            onPress={() =>
              aiSuggestion.suggested_category &&
              setSelectedCategoryId(aiSuggestion.suggested_category.id)
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: PRIMARY_LIGHT,
              borderWidth: 1,
              borderColor: '#BBF7D0',
              borderRadius: 12,
              padding: 10,
              marginBottom: 12,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 18 }}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: PRIMARY, fontWeight: '700' }}>
                AI suggests: {aiSuggestion.suggested_category.emoji}{' '}
                {aiSuggestion.suggested_category.name_en}
              </Text>
              <Text style={{ fontSize: 10, color: TEXT_MUTED }}>
                {Math.round(aiSuggestion.confidence * 100)}% confidence · Tap to apply
              </Text>
            </View>
            <Text style={{ color: PRIMARY, fontWeight: '800', fontSize: 14 }}>→</Text>
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {allCategories.map((cat: { id: string; name_en: string; icon_emoji?: string }) => {
            const selected = selectedCategoryId === cat.id;
            const isAiSuggested = aiSuggestion?.suggested_category?.id === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategoryId(cat.id)}
                style={{
                  width: '30%',
                  aspectRatio: 1,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: selected ? PRIMARY : isAiSuggested ? '#86EFAC' : BORDER,
                  backgroundColor: selected ? PRIMARY_LIGHT : isAiSuggested ? '#F0FFF4' : '#fff',
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
                    color: selected ? PRIMARY : TEXT_MAIN,
                  }}
                  numberOfLines={2}
                >
                  {cat.name_en}
                </Text>
                {isAiSuggested && !selected && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: PRIMARY,
                      borderRadius: 6,
                      width: 14,
                      height: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 8, color: '#fff' }}>✨</Text>
                  </View>
                )}
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
              color: TEXT_LABEL,
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
              borderColor: BORDER,
              fontSize: 14,
              color: TEXT_MAIN,
            }}
            autoCapitalize="sentences"
            maxLength={200}
          />
          <Text style={{ fontSize: 10, color: TEXT_LABEL, textAlign: 'right', marginTop: 4 }}>
            {title.length}/200
          </Text>
        </View>

        {/* Description + AI Assistant ─────────────────────────────────────── */}
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: TEXT_LABEL,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                flex: 1,
              }}
            >
              Describe the Problem <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: PRIMARY_LIGHT,
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
                gap: 3,
              }}
            >
              <Text style={{ fontSize: 10 }}>✨</Text>
              <Text style={{ fontSize: 9, color: PRIMARY, fontWeight: '700' }}>AI-assisted</Text>
            </View>
          </View>
          <TextInput
            value={description}
            onChangeText={handleDescriptionChange}
            placeholder="What happened? How long? What have you tried? Any special access requirements?"
            multiline
            numberOfLines={5}
            style={{
              backgroundColor: '#fff',
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: aiLoading ? '#86EFAC' : BORDER,
              fontSize: 14,
              color: TEXT_MAIN,
              textAlignVertical: 'top',
              minHeight: 120,
            }}
            autoCapitalize="sentences"
            maxLength={2000}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontSize: 10, color: TEXT_LABEL }}>More detail = better bids</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {aiLoading && <ActivityIndicator size="small" color={PRIMARY} />}
              <Text style={{ fontSize: 10, color: TEXT_LABEL }}>{description.length}/2000</Text>
            </View>
          </View>

          {/* AI Suggestion Panel */}
          <AiSuggestionPanel
            suggestion={aiSuggestion}
            loading={aiLoading}
            onApplyCategory={(id, name) => {
              setSelectedCategoryId(id);
              Toast.show({
                type: 'success',
                text1: `Category set to ${name}`,
                text2: 'You can still change it above',
              });
            }}
            onApplyBudget={(amount) => {
              setBudget(String(amount));
              Toast.show({
                type: 'success',
                text1: `Budget set to ${formatRWF(amount)} RWF`,
              });
            }}
          />
        </View>

        {/* Additional Notes */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: TEXT_LABEL,
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
              borderColor: BORDER,
              fontSize: 14,
              color: TEXT_MAIN,
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
              color: TEXT_LABEL,
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
                  borderColor: urgency === u.value ? PRIMARY : BORDER,
                  backgroundColor: urgency === u.value ? PRIMARY_LIGHT : '#fff',
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
                    color: urgency === u.value ? PRIMARY : TEXT_MAIN,
                  }}
                >
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 10, color: TEXT_LABEL, marginTop: 4 }}>
            {URGENCY_OPTIONS.find((u) => u.value === urgency)?.desc}
          </Text>
        </View>

        {/* Scheduled Date */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: TEXT_LABEL,
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
              borderColor: BORDER,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 14, color: scheduledDate ? TEXT_MAIN : TEXT_LABEL }}>
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
            onChange={(_: unknown, date: unknown) => {
              setShowDatePicker(false);
              if (date instanceof Date) setScheduledDate(date);
            }}
          />
        )}

        {/* ── Sprint 12: Make this recurring ──────────────────────────── */}
        <View
          style={{
            marginBottom: 20,
            backgroundColor: isRecurring ? '#F0FDF4' : '#FAFAFA',
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: isRecurring ? '#BBF7D0' : '#E5E7EB',
            padding: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => setIsRecurring((p) => !p)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRecurring ? '#1B5E3B' : '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 18 }}>🔄</Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color: isRecurring ? '#1B5E3B' : '#111827',
                  }}
                >
                  Make this recurring
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                  Auto-book the same service regularly
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                backgroundColor: isRecurring ? '#1B5E3B' : '#D1D5DB',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#FFFFFF',
                  transform: [{ translateX: isRecurring ? 18 : 0 }],
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              />
            </View>
          </TouchableOpacity>

          {isRecurring && (
            <View style={{ marginTop: 16, gap: 14 }}>
              {/* Frequency */}
              <View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  Frequency
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(
                    [
                      ['weekly', 'Weekly'],
                      ['biweekly', 'Every 2 Weeks'],
                      ['monthly', 'Monthly'],
                    ] as [string, string][]
                  ).map(([val, label]) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setRecurringFrequency(val as typeof recurringFrequency)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: recurringFrequency === val ? '#1B5E3B' : '#E5E7EB',
                        backgroundColor: recurringFrequency === val ? '#1B5E3B' : '#FFFFFF',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: recurringFrequency === val ? '#FFFFFF' : '#374151',
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Day of week (weekly/biweekly) */}
              {(recurringFrequency === 'weekly' || recurringFrequency === 'biweekly') && (
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    Day of Week
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                      <TouchableOpacity
                        key={day}
                        onPress={() => setRecurringDayOfWeek(i)}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: recurringDayOfWeek === i ? '#1B5E3B' : '#E5E7EB',
                          backgroundColor: recurringDayOfWeek === i ? '#1B5E3B' : '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: recurringDayOfWeek === i ? '#FFFFFF' : '#374151',
                          }}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Day of month (monthly) */}
              {recurringFrequency === 'monthly' && (
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    Day of Month (1–28)
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setRecurringDayOfMonth((d) => Math.max(1, d - 1))}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        backgroundColor: '#F9FAFB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 20, color: '#374151' }}>−</Text>
                    </TouchableOpacity>
                    <View
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: '#1B5E3B',
                        backgroundColor: '#F0FDF4',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#1B5E3B' }}>
                        {recurringDayOfMonth}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setRecurringDayOfMonth((d) => Math.min(28, d + 1))}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        backgroundColor: '#F9FAFB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 20, color: '#374151' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Prefer same artisan */}
              <TouchableOpacity
                onPress={() => setRecurringPreferSameArtisan((p) => !p)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                activeOpacity={0.8}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: recurringPreferSameArtisan ? '#1B5E3B' : '#D1D5DB',
                    backgroundColor: recurringPreferSameArtisan ? '#1B5E3B' : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {recurringPreferSameArtisan && (
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>✓</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                    Prefer same artisan each time
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                    Re-book your most trusted artisan automatically
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Summary */}
              <View
                style={{
                  backgroundColor: '#1B5E3B',
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>🗓️</Text>
                <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600', flex: 1 }}>
                  {recurringFrequency === 'weekly' &&
                    `Every ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][recurringDayOfWeek]}`}
                  {recurringFrequency === 'biweekly' &&
                    `Every other ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][recurringDayOfWeek]}`}
                  {recurringFrequency === 'monthly' &&
                    `${recurringDayOfMonth}${['st', 'nd', 'rd'][recurringDayOfMonth - 1] || 'th'} of every month`}
                  {' · '}
                  {recurringPreferSameArtisan ? 'Same artisan preferred' : 'Open bidding each time'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Budget — with AI price hint */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: TEXT_LABEL,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Your Budget (RWF){' '}
            <Text style={{ fontSize: 10, fontWeight: '400', textTransform: 'none' }}>
              — optional
            </Text>
          </Text>

          {/* AI price range hint */}
          {aiSuggestion?.typical_price_range && !budget && (
            <TouchableOpacity
              onPress={() => {
                if (aiSuggestion.typical_price_range) {
                  const mid = Math.round(
                    (aiSuggestion.typical_price_range.min + aiSuggestion.typical_price_range.max) /
                      2,
                  );
                  setBudget(String(mid));
                  Toast.show({
                    type: 'success',
                    text1: `Budget set to ${formatRWF(mid)} RWF`,
                  });
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ECFDF5',
                borderWidth: 1,
                borderColor: '#6EE7B7',
                borderRadius: 10,
                padding: 10,
                marginBottom: 8,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14 }}>📈</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: TEXT_MAIN }}>
                  Similar jobs:{' '}
                  <Text style={{ fontWeight: '700', color: '#065F46' }}>
                    {formatRWF(aiSuggestion.typical_price_range.min)} –{' '}
                    {formatRWF(aiSuggestion.typical_price_range.max)} RWF
                  </Text>
                </Text>
                <Text style={{ fontSize: 10, color: TEXT_MUTED }}>Tap to use midpoint</Text>
              </View>
              <Text style={{ color: '#065F46', fontWeight: '800' }}>→</Text>
            </TouchableOpacity>
          )}

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
              borderColor: BORDER,
              fontSize: 14,
              color: TEXT_MAIN,
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
                  borderColor: budgetNegotiable ? PRIMARY : BORDER,
                  backgroundColor: budgetNegotiable ? PRIMARY : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {budgetNegotiable && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 12, color: TEXT_MUTED }}>Open to negotiate if needed</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Photos */}
        <View style={{ marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: TEXT_LABEL,
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
                <Text style={{ fontSize: 9, color: TEXT_LABEL, marginTop: 2 }}>Add photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Fixed footer ─────────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: Platform.OS === 'ios' ? 32 : 20,
          paddingTop: 12,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: BORDER,
        }}
      >
        <TouchableOpacity
          onPress={handleNext}
          accessibilityLabel="Continue to location"
          style={{
            backgroundColor: PRIMARY,
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
