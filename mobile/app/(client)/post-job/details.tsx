// File: mobile/app/(client)/post-job/details.tsx
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function JobDetails() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [when, setWhen] = useState('Tomorrow');
  const [photos, setPhotos] = useState<string[]>([]);

  const pickImage = async () => {
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
      Toast.show({ type: 'error', text1: 'Add more detail', text2: 'Describe the job clearly (15+ chars)' });
      return;
    }
    router.push({
      pathname: '/(client)/post-job/location',
      params: { categoryId, title, description, budget, photos: JSON.stringify(photos) },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="pt-14 pb-4 px-5 bg-card border-b border-border">
        <Text className="text-xl font-extrabold">Job Details</Text>
        <View className="flex-row mt-2">
          {[1, 2, 3].map((s) => (
            <View key={s} className={`h-1 flex-1 rounded-full mr-1 ${s <= 1 ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Job Title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fix leaking kitchen sink"
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            autoCapitalize="sentences"
            maxLength={100}
          />
          <Text className="text-[10px] text-muted-foreground text-right mt-1">{title.length}/100</Text>
        </View>

        {/* Description */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Description *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the problem in detail — what happened, how long, severity…"
            multiline
            numberOfLines={4}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
            style={{ textAlignVertical: 'top', minHeight: 100 }}
            autoCapitalize="sentences"
            maxLength={500}
          />
          <Text className="text-[10px] text-muted-foreground text-right mt-1">{description.length}/500</Text>
        </View>

        {/* When */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">When do you need it?</Text>
          <View className="flex-row gap-2">
            {['Today', 'Tomorrow', 'This week', 'Flexible'].map((w) => (
              <TouchableOpacity
                key={w}
                onPress={() => setWhen(w)}
                accessibilityLabel={w}
                className={`flex-1 py-2.5 rounded-xl border-2 items-center ${when === w ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              >
                <Text className={`text-[11px] font-bold ${when === w ? 'text-primary' : 'text-foreground'}`}>{w}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Budget */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Your Budget (RWF) — optional</Text>
          <TextInput
            value={budget}
            onChangeText={setBudget}
            placeholder="e.g. 15000"
            keyboardType="numeric"
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm"
          />
          <Text className="text-[10px] text-muted-foreground mt-1">Leave blank to receive open bids</Text>
        </View>

        {/* Photos */}
        <View className="mb-8">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Photos ({photos.length}/3) — optional
          </Text>
          <View className="flex-row gap-3">
            {photos.map((p, i) => (
              <View key={i} className="relative w-20 h-20">
                <Image source={{ uri: `data:image/jpeg;base64,${p}` }} className="w-full h-full rounded-2xl" />
                <TouchableOpacity
                  onPress={() => setPhotos(photos.filter((_, j) => j !== i))}
                  accessibilityLabel="Remove photo"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full items-center justify-center"
                >
                  <Text className="text-white text-[10px] font-bold">✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 3 && (
              <TouchableOpacity
                onPress={pickImage}
                accessibilityLabel="Add photo"
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-muted/30 items-center justify-center"
              >
                <Text className="text-2xl text-muted-foreground">📷</Text>
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
