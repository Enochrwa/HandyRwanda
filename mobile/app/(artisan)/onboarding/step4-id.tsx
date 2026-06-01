// File: mobile/app/(artisan)/onboarding/step4-id.tsx
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

export default function IDStep() {
  const router = useRouter();
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [nationalId, setNationalId] = useState('');
  const [loading, setLoading] = useState(false);

  const pickImage = async (setter: (val: string) => void, useCamera = false) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perm.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission denied' });
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
          base64: true,
          cameraType: ImagePicker.CameraType.front,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
          base64: true,
        });

    if (!result.canceled && result.assets[0].base64) {
      setter(result.assets[0].base64);
    }
  };

  const handleSubmit = async () => {
    if (!idPhoto || !selfie) {
      Toast.show({
        type: 'error',
        text1: 'Missing documents',
        text2: 'Please upload both ID and selfie',
      });
      return;
    }
    if (nationalId.length > 0 && nationalId.replace(/\D/g, '').length !== 16) {
      Toast.show({
        type: 'error',
        text1: 'Invalid National ID',
        text2: 'Must be exactly 16 digits',
      });
      return;
    }

    setLoading(true);
    try {
      await api.post('/artisans/profile/me/id-verification', {
        national_id_doc_base64: idPhoto,
        selfie_base64: selfie,
        ...(nationalId && { national_id_number: nationalId.replace(/\D/g, '') }),
      });
      Toast.show({
        type: 'success',
        text1: '🎉 Documents submitted!',
        text2: "We'll review within 24 hours.",
      });
      router.replace('/(tabs)/pro');
    } catch (error: any) {
      const msg = error?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Submission failed',
        text2: typeof msg === 'string' ? msg : 'Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip verification?',
      'You can submit ID documents later from your profile. Verified artisans get more bookings.',
      [
        { text: 'Skip for now', onPress: () => router.replace('/(tabs)/pro') },
        { text: 'Stay and verify', style: 'cancel' },
      ],
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="pt-14 pb-4 px-5 bg-primary">
        <Text className="text-white text-xl font-extrabold">ID Verification</Text>
        <Text className="text-white/80 text-sm mt-0.5">
          Step 4 of 4 — Builds trust with clients
        </Text>
        <View className="flex-row mt-3 gap-1">
          {[1, 2, 3, 4].map((s) => (
            <View key={s} className="h-1.5 flex-1 rounded-full bg-white" />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        {/* National ID number */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            National ID Number (16 digits)
          </Text>
          <TextInput
            value={nationalId}
            onChangeText={setNationalId}
            placeholder="1 1998 8 0123456 7 89"
            keyboardType="number-pad"
            maxLength={18}
            className="bg-card p-4 rounded-2xl border border-border text-foreground text-sm tracking-widest"
          />
        </View>

        {/* ID Document */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            ID Document Photo *
          </Text>
          {idPhoto ? (
            <View className="relative">
              <Image
                source={{ uri: `data:image/jpeg;base64,${idPhoto}` }}
                className="w-full h-40 rounded-2xl"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setIdPhoto(null)}
                accessibilityLabel="Remove ID photo"
                className="absolute top-2 right-2 bg-black/50 w-8 h-8 rounded-full items-center justify-center"
              >
                <Text className="text-white font-bold">✕</Text>
              </TouchableOpacity>
              <View className="absolute bottom-2 left-2 bg-success/90 px-2 py-1 rounded-lg">
                <Text className="text-white text-xs font-bold">✓ Uploaded</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => pickImage(setIdPhoto)}
              accessibilityLabel="Upload ID document"
              className="border-2 border-dashed border-border rounded-2xl h-36 items-center justify-center bg-muted/20"
            >
              <Text className="text-3xl mb-2">🪪</Text>
              <Text className="font-semibold text-foreground text-sm">
                Tap to upload ID card / Passport
              </Text>
              <Text className="text-xs text-muted-foreground mt-1">Front of your national ID</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selfie */}
        <View className="mb-5">
          <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Selfie with ID *
          </Text>
          {selfie ? (
            <View className="relative">
              <Image
                source={{ uri: `data:image/jpeg;base64,${selfie}` }}
                className="w-full h-40 rounded-2xl"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setSelfie(null)}
                accessibilityLabel="Remove selfie"
                className="absolute top-2 right-2 bg-black/50 w-8 h-8 rounded-full items-center justify-center"
              >
                <Text className="text-white font-bold">✕</Text>
              </TouchableOpacity>
              <View className="absolute bottom-2 left-2 bg-success/90 px-2 py-1 rounded-lg">
                <Text className="text-white text-xs font-bold">✓ Uploaded</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => pickImage(setSelfie, true)}
              accessibilityLabel="Take selfie"
              className="border-2 border-dashed border-border rounded-2xl h-36 items-center justify-center bg-muted/20"
            >
              <Text className="text-3xl mb-2">🤳</Text>
              <Text className="font-semibold text-foreground text-sm">
                Take selfie holding your ID
              </Text>
              <Text className="text-xs text-muted-foreground mt-1">Uses front camera</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Trust note */}
        <View className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <Text className="text-xs font-bold text-blue-800 mb-1">🔒 Your privacy matters</Text>
          <Text className="text-xs text-blue-700 leading-5">
            Documents are encrypted and only reviewed by HandyRwanda admins for verification. They
            are never shared with clients.
          </Text>
        </View>
      </ScrollView>

      <View className="px-5 pb-8 pt-3 bg-card border-t border-border gap-2">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !idPhoto || !selfie}
          accessibilityLabel="Submit verification"
          className={`bg-primary rounded-2xl py-4 items-center ${!idPhoto || !selfie || loading ? 'opacity-50' : ''}`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-extrabold text-base">Submit for Verification ✓</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSkip}
          accessibilityLabel="Skip for now"
          className="py-3 items-center"
        >
          <Text className="text-muted-foreground text-sm">Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
