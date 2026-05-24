import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert } from 'react-native';

import api from '../../../services/api';
import { colors, typography, spacing, radius } from '../../../src/theme';

export default function IDStep() {
  const router = useRouter();
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (setter: (val: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setter(result.assets[0].base64 || '');
    }
  };

  const handleFinish = async () => {
    if (!idPhoto || !selfie) {
      Alert.alert('Error', 'Please upload both photos');
      return;
    }

    setLoading(true);
    try {
      await api.post('/artisans/profile/me/id-verification', {
        national_id_number: 'PENDING',
        national_id_doc_base64: idPhoto,
        selfie_base64: selfie,
      });
      router.replace('/(artisan)/home');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Trust is everything</Text>
      <Text style={styles.subtitle}>Step 4 of 4: National ID Verification</Text>

      <View style={styles.section}>
        <Text style={styles.label}>National ID (Front)</Text>
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setIdPhoto)}>
          {idPhoto ? (
            <Image source={{ uri: `data:image/jpeg;base64,${idPhoto}` }} style={styles.preview} />
          ) : (
            <Text style={styles.uploadText}>Tap to Upload ID</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Selfie holding ID</Text>
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setSelfie)}>
          {selfie ? (
            <Image source={{ uri: `data:image/jpeg;base64,${selfie}` }} style={styles.preview} />
          ) : (
            <Text style={styles.uploadText}>Tap to Take Selfie</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        Your documents are stored securely and used only for verification. Verification usually
        takes 24–48 hours.
      </Text>

      <TouchableOpacity
        style={[styles.button, (!idPhoto || !selfie) && styles.disabledButton]}
        onPress={handleFinish}
        disabled={loading || !idPhoto || !selfie}
      >
        <Text style={styles.buttonText}>{loading ? 'Uploading...' : 'Finish Onboarding'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.bg,
    flexGrow: 1,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.subheading,
    marginBottom: spacing.sm,
  },
  uploadBox: {
    aspectRatio: 1.6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  uploadText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.subheading,
    color: colors.surface,
  },
});
