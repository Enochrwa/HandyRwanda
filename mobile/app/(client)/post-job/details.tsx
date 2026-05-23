import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radius } from '../../../src/theme';

export default function JobDetails() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setPhotos([...photos, result.assets[0].base64 || '']);
    }
  };

  const handleNext = () => {
    router.push({
      pathname: '/(client)/post-job/location',
      params: { categoryId, title, description, budget, photos: JSON.stringify(photos) },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Job Details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Job Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Fix leaking kitchen sink"
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe what needs to be done..."
          multiline
          value={description}
          onChangeText={setDescription}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Estimated Budget (RWF)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 10000"
          keyboardType="number-pad"
          value={budget}
          onChangeText={setBudget}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Photos (Optional)</Text>
        <View style={styles.photoList}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: `data:image/jpeg;base64,${p}` }} style={styles.preview} />
          ))}
          {photos.length < 5 && (
            <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
              <Text style={styles.addPhotoText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Continue to Location</Text>
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
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.subheading,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...typography.body,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  photoList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preview: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
  },
  addPhoto: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addPhotoText: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonText: {
    ...typography.subheading,
    color: colors.surface,
  },
});
