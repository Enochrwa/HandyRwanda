// File: mobile/app/(client)/post-job/details.tsx
import DateTimePicker from '@react-native-community/datetimepicker';
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
  Switch,
} from 'react-native';
import Toast from 'react-native-toast-message';

const URGENCY_OPTIONS = [
  { value: 'flexible', label: 'Flexible', emoji: '📅', desc: 'Within 2 weeks' },
  { value: 'this_week', label: 'This Week', emoji: '🗓️', desc: '7 days' },
  { value: 'tomorrow', label: 'Tomorrow', emoji: '⏰', desc: '24 hours' },
  { value: 'today', label: 'Today', emoji: '🔥', desc: 'Today' },
  { value: 'urgent', label: 'Urgent!', emoji: '🚨', desc: '2 hours' },
] as const;

export default function JobDetails() {
  const router = useRouter();
  const { categoryId, categoryName } = useLocalSearchParams<{ categoryId: string; categoryName?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetNegotiable, setBudgetNegotiable] = useState(true);
  const [urgency, setUrgency] = useState<string>('flexible');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  const pickImage = async () => {
    if (photos.length >= 5) {
      Toast.show({ type: 'error', text1: 'Max 5 photos allowed' });
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission denied' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      if (photos.length >= 5) {
        Toast.show({ type: 'info', text1: 'Max 5 photos', text2: 'Remove a photo first' });
        return;
      }
      setPhotos([...photos, result.assets[0].base64]);
    }
  };

  const handleNext = () => {
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
        categoryId,
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

  const formattedDateTime = scheduledTime
    ? scheduledTime.toLocaleString('en-RW', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="pt-14 pb-4 px-5 bg-card border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-primary font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-extrabold">Job Details</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          Step 1 of 3 — Describe what you need
        </Text>
        <View className="flex-row mt-2">
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              className={`h-1 flex-1 rounded-full mr-1 ${s <= 1 ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Job Title <Text className="text-destructive">*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fix leaking kitchen sink under the cabinet"
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            autoCapitalize="sentences"
            maxLength={200}
          />
          <Text className="text-[10px] text-muted-foreground text-right mt-1">
            {title.length}/200
          </Text>
        </View>

        {/* Description */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Describe the Problem <Text className="text-destructive">*</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What happened? How long? What have you tried? Any special access requirements (floor number, gate code)?"
            multiline
            numberOfLines={5}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            style={{ textAlignVertical: 'top', minHeight: 120 }}
            autoCapitalize="sentences"
            maxLength={2000}
          />
          <Text className="text-[10px] text-muted-foreground text-right mt-1">
            {description.length}/2000 — more detail = better bids
          </Text>
        </View>

        {/* Additional Notes */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Additional Notes <Text className="text-[10px] font-normal">(optional)</Text>
          </Text>
          <TextInput
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            placeholder="Materials available on-site, preferred artisan qualities, parking info, etc."
            multiline
            numberOfLines={2}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            style={{ textAlignVertical: 'top', minHeight: 70 }}
            autoCapitalize="sentences"
            maxLength={1000}
          />
        </View>

        {/* Urgency */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            How Urgent? <Text className="text-destructive">*</Text>
          </Text>
          <View className="flex-row gap-1.5">
            {URGENCY_OPTIONS.map((u) => (
              <TouchableOpacity
                key={u.value}
                onPress={() => setUrgency(u.value)}
                accessibilityLabel={`${u.label}: ${u.desc}`}
                className={`flex-1 py-2 px-1 rounded-xl border-2 items-center ${
                  urgency === u.value ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <Text style={{ fontSize: 16 }}>{u.emoji}</Text>
                <Text
                  className={`text-[9px] font-bold mt-0.5 text-center ${
                    urgency === u.value ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text className="text-[10px] text-muted-foreground mt-1">
            {URGENCY_OPTIONS.find((u) => u.value === urgency)?.desc}
          </Text>
        </View>

        {/* Scheduled Date */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Preferred Date/Time <Text className="text-[10px] font-normal">(optional)</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="bg-card p-4 rounded-2xl border border-border flex-row items-center justify-between"
          >
            <Text
              className={`text-sm ${scheduledDate ? 'text-foreground' : 'text-muted-foreground'}`}
            >
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
            <Text className="text-lg">📅</Text>
          </TouchableOpacity>
          {scheduledDate && (
            <TouchableOpacity onPress={() => setScheduledDate(null)} className="mt-1">
              <Text className="text-xs text-destructive">Clear date</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={scheduledDate ?? new Date()}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(_: any, date: any) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date instanceof Date) {
                setScheduledDate(date);
              }
            }}
          />
        )}

        {/* Budget */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Your Budget (RWF){' '}
            <Text className="text-[10px] font-normal">— optional, leave blank for open bids</Text>
          </Text>
          <TextInput
            value={specialRequirements}
            onChangeText={setSpecialRequirements}
            placeholder="e.g. Must bring own tools, speak Kinyarwanda, have 3+ years experience…"
            multiline
            numberOfLines={3}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            style={{ textAlignVertical: 'top', minHeight: 70 }}
            maxLength={500}
          />
        </View>

        {/* Remote possible */}
        <View className="mb-5 flex-row items-center justify-between bg-card p-4 rounded-2xl border border-border">
          <View className="flex-1 mr-4">
            <Text className="font-bold text-sm text-foreground">Remote/Phone possible?</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Can this be done remotely or via phone consultation?
            </Text>
          </View>
          <Switch
            value={isRemotePossible}
            onValueChange={setIsRemotePossible}
            trackColor={{ false: '#E2E8F0', true: '#1B5E3B' }}
          />
          {budget ? (
            <TouchableOpacity
              onPress={() => setBudgetNegotiable(!budgetNegotiable)}
              className="flex-row items-center mt-2 gap-2"
            >
              <View
                className={`w-4 h-4 rounded border-2 items-center justify-center ${
                  budgetNegotiable ? 'bg-primary border-primary' : 'border-border'
                }`}
              >
                {budgetNegotiable && <Text className="text-white text-[10px]">✓</Text>}
              </View>
              <Text className="text-xs text-muted-foreground">Open to negotiate if needed</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Photos */}
        <View className="mb-8">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Photos ({photos.length}/5){' '}
            <Text className="text-[10px] font-normal">— recommended: artisans quote better</Text>
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {photos.map((p, i) => (
              <View key={i} className="relative w-20 h-20">
                <Image
                  source={{ uri: `data:image/jpeg;base64,${p}` }}
                  className="w-full h-full rounded-2xl"
                />
                <TouchableOpacity
                  onPress={() => setPhotos(photos.filter((_, j) => j !== i))}
                  accessibilityLabel="Remove photo"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full items-center justify-center"
                >
                  <Text className="text-white text-[10px] font-bold">✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity
                onPress={pickImage}
                accessibilityLabel="Add photo"
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-muted/30 items-center justify-center"
              >
                <Text className="text-2xl text-muted-foreground">📷</Text>
                <Text className="text-[9px] text-muted-foreground mt-0.5">Add photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <View className="px-5 pb-8 pt-3 bg-card border-t border-border">
        <TouchableOpacity
          onPress={handleNext}
          accessibilityLabel="Continue to location"
          className="bg-primary rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-extrabold text-base">Continue → Choose Location</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
