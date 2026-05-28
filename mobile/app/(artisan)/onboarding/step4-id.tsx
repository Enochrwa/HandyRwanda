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
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

export default function IDStep() {
  const router = useRouter();
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [nationalId, setNationalId] = useState('');
  const [loading, setLoading] = useState(false);

  const pickImage = async (setter: (val: string) => void, camera: boolean = false) => {
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission denied',
          text2: 'We need camera/library access',
        });
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      };

      const result = camera
        ? await ImagePicker.launchCameraAsync({
            ...options,
            cameraType: ImagePicker.CameraType.front,
          })
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled) {
        setter(result.assets[0].base64 || '');
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to pick image' });
    }
  };

  const handleFinish = async () => {
    if (!idPhoto || !selfie || !nationalId) {
      Toast.show({
        type: 'error',
        text1: 'Missing info',
        text2: 'Please fill all fields and upload photos',
      });
      return;
    }

    setLoading(true);
    try {
      await api.post('/artisans/profile/me/id-verification', {
        national_id_number: nationalId,
        national_id_doc_base64: idPhoto,
        selfie_base64: selfie,
      });
      Toast.show({
        type: 'success',
        text1: 'Verification submitted!',
        text2: 'We will review it shortly.',
      });
      router.replace('/(tabs)/pro');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.detail ?? 'Failed to submit',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-background p-6">
      <Text className="text-2xl font-bold text-foreground">Trust is everything</Text>
      <Text className="text-muted-foreground mb-8">Step 4 of 4: National ID Verification</Text>

      <View className="mb-6">
        <Text className="text-sm font-medium mb-1">National ID Number</Text>
        <TextInput
          className="bg-card p-4 rounded-xl border border-border text-foreground"
          placeholder="Enter your 16-digit ID number"
          keyboardType="numeric"
          maxLength={16}
          value={nationalId}
          onChangeText={setNationalId}
        />
      </View>

      <View className="mb-6">
        <Text className="text-sm font-medium mb-2">National ID (Front)</Text>
        <TouchableOpacity
          accessibilityLabel="Button"
          className="aspect-[1.6] bg-card rounded-xl border-2 border-dashed border-border items-center justify-center overflow-hidden"
          onPress={() => pickImage(setIdPhoto)}
        >
          {idPhoto ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${idPhoto}` }}
              className="w-full h-full"
            />
          ) : (
            <Text className="text-primary font-bold">Tap to Take ID Photo</Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-medium mb-2">Take a Selfie</Text>
        <TouchableOpacity
          accessibilityLabel="Button"
          className="aspect-[1.6] bg-card rounded-xl border-2 border-dashed border-border items-center justify-center overflow-hidden"
          onPress={() => pickImage(setSelfie, true)}
        >
          {selfie ? (
            <Image source={{ uri: `data:image/jpeg;base64,${selfie}` }} className="w-full h-full" />
          ) : (
            <Text className="text-primary font-bold">Tap to Take Selfie</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text className="text-xs text-muted-foreground text-center mb-8 px-4">
        Photos are encrypted and only used for verification. Verification usually takes 24–48
        hours.
      </Text>

      <TouchableOpacity
        accessibilityLabel="Button"
        className={`bg-primary p-4 rounded-xl items-center ${!idPhoto || !selfie || !nationalId ? 'opacity-50' : ''}`}
        onPress={handleFinish}
        disabled={loading || !idPhoto || !selfie || !nationalId}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold">Finish Onboarding</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
