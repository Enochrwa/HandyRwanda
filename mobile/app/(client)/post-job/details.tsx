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

type Urgency = 'flexible' | 'this_week' | 'tomorrow' | 'today' | 'urgent';
type JobType = 'one_time' | 'recurring' | 'emergency';

const URGENCY_OPTIONS: { value: Urgency; label: string; emoji: string }[] = [
  { value: 'flexible', label: 'Flexible', emoji: '📅' },
  { value: 'this_week', label: 'This Week', emoji: '🗓️' },
  { value: 'tomorrow', label: 'Tomorrow', emoji: '⏰' },
  { value: 'today', label: 'Today', emoji: '🔥' },
  { value: 'urgent', label: 'Urgent!', emoji: '🚨' },
];

const JOB_TYPE_OPTIONS: { value: JobType; label: string; desc: string }[] = [
  { value: 'one_time', label: 'One-time', desc: 'Single job' },
  { value: 'recurring', label: 'Recurring', desc: 'Regular work' },
  { value: 'emergency', label: 'Emergency', desc: 'ASAP fix' },
];

export default function JobDetails() {
  const router = useRouter();
  const { categoryId, categoryName } = useLocalSearchParams<{ categoryId: string; categoryName?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('flexible');
  const [jobType, setJobType] = useState<JobType>('one_time');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [isRemotePossible, setIsRemotePossible] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

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
        budget,
        budgetMax,
        urgency,
        jobType,
        specialRequirements,
        isRemotePossible: isRemotePossible ? '1' : '0',
        photos: JSON.stringify(photos),
        scheduledTime: scheduledTime ? scheduledTime.toISOString() : '',
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
        {categoryName && (
          <Text className="text-sm text-muted-foreground mt-0.5">Category: {categoryName}</Text>
        )}
        <View className="flex-row mt-3">
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
            Job Title *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fix leaking kitchen sink pipe"
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
            Detailed Description *
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the problem in detail — what happened, how long it's been occurring, severity, access, materials needed…"
            multiline
            numberOfLines={5}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            style={{ textAlignVertical: 'top', minHeight: 120 }}
            autoCapitalize="sentences"
            maxLength={2000}
          />
          <Text className="text-[10px] text-muted-foreground text-right mt-1">
            {description.length}/2000
          </Text>
        </View>

        {/* Job Type */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Job Type
          </Text>
          <View className="flex-row gap-2">
            {JOB_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setJobType(opt.value)}
                className={`flex-1 py-3 px-2 rounded-xl border-2 items-center ${jobType === opt.value ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              >
                <Text
                  className={`text-[11px] font-bold ${jobType === opt.value ? 'text-primary' : 'text-foreground'}`}
                >
                  {opt.label}
                </Text>
                <Text className="text-[9px] text-muted-foreground mt-0.5">{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Urgency */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            When do you need it?
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {URGENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setUrgency(opt.value)}
                className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border-2 ${urgency === opt.value ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              >
                <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                <Text
                  className={`text-[11px] font-bold ${urgency === opt.value ? 'text-primary' : 'text-foreground'}`}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Scheduled Date/Time */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Preferred Date & Time (optional)
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="bg-card p-4 rounded-2xl border border-border flex-row items-center justify-between"
          >
            <Text className={`text-sm ${scheduledTime ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
              {formattedDateTime ?? 'Tap to pick date & time'}
            </Text>
            <Text className="text-lg">📅</Text>
          </TouchableOpacity>
          {scheduledTime && (
            <TouchableOpacity onPress={() => setScheduledTime(null)} className="mt-1">
              <Text className="text-xs text-destructive text-right">Clear date</Text>
            </TouchableOpacity>
          )}
          {showDatePicker && (
            <DateTimePicker
              value={scheduledTime ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) {
                  setScheduledTime(date);
                  setShowTimePicker(true);
                }
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={scheduledTime ?? new Date()}
              mode="time"
              onChange={(_, date) => {
                setShowTimePicker(false);
                if (date) setScheduledTime(date);
              }}
            />
          )}
        </View>

        {/* Budget */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Budget Range (RWF) — optional
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-[10px] text-muted-foreground mb-1">Min / Fixed</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                placeholder="e.g. 10,000"
                keyboardType="numeric"
                className="bg-card p-3.5 rounded-2xl border border-border text-foreground text-sm"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-muted-foreground mb-1">Max (optional)</Text>
              <TextInput
                value={budgetMax}
                onChangeText={setBudgetMax}
                placeholder="e.g. 25,000"
                keyboardType="numeric"
                className="bg-card p-3.5 rounded-2xl border border-border text-foreground text-sm"
              />
            </View>
          </View>
          <Text className="text-[10px] text-muted-foreground mt-1">
            Leave blank to receive open bids from artisans
          </Text>
        </View>

        {/* Special Requirements */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Special Requirements (optional)
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
        </View>

        {/* Photos */}
        <View className="mb-8">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Photos ({photos.length}/5) — optional
          </Text>
          <Text className="text-[10px] text-muted-foreground mb-2">
            Add photos of the problem area to help artisans give accurate bids
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
                <Text className="text-[9px] text-muted-foreground mt-0.5">Add</Text>
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
