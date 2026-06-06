// File: mobile/app/(artisan)/profile/portfolio.tsx
import { Plus, X, Trash2 } from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';

export default function PortfolioScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: photos, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/artisans/portfolio/me').then((r) => r.data),
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].base64 || null);
      setModalVisible(true);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (data: { photo_base64: string; description: string }) =>
      api.post('/artisans/portfolio', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setModalVisible(false);
      setSelectedImage(null);
      setCaption('');
      Toast.show({ type: 'success', text1: 'Photo added!' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Upload failed' }),
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/artisans/portfolio/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      Toast.show({ type: 'success', text1: 'Photo removed' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Delete failed' }),
  });

  const handleDelete = (id: string) => {
    Alert.alert('Delete Photo', 'Are you sure you want to remove this from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleUpload = () => {
    if (!selectedImage) return;
    setUploading(true);
    uploadMutation.mutate({ photo_base64: selectedImage, description: caption });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1B5E3B" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background p-4">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-2xl font-bold">Your Portfolio</Text>
          <Text className="text-muted-foreground">Showcase your best work</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Button"
          onPress={pickImage}
          className="bg-primary w-12 h-12 rounded-full items-center justify-center"
        >
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityLabel="Button"
            onLongPress={() => handleDelete(item.id)}
            className="flex-1 mb-3 rounded-2xl overflow-hidden border border-border bg-card aspect-square"
          >
            <Image source={{ uri: item.image_url }} className="w-full h-full" />
            {item.description && (
              <View className="absolute bottom-0 left-0 right-0 bg-black/40 p-2">
                <Text className="text-white text-[10px]" numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
            )}
            <TouchableOpacity
              accessibilityLabel="Button"
              onPress={() => handleDelete(item.id)}
              className="absolute top-2 right-2 bg-black/40 p-1.5 rounded-full"
            >
              <Trash2 size={12} color="white" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center mt-20 border-2 border-dashed border-border p-10 rounded-3xl">
            <Text className="text-muted-foreground text-center">
              No portfolio photos yet.{'\n'}Tap the + button to add one.
            </Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-[40px] p-6 pb-10">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold">Add Portfolio Photo</Text>
              <TouchableOpacity accessibilityLabel="Button" onPress={() => setModalVisible(false)}>
                <X size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${selectedImage}` }}
                className="w-full aspect-[1.6] rounded-2xl mb-6 bg-muted"
              />
            )}

            <TextInput
              className="bg-muted p-4 rounded-xl border border-border mb-6 text-start"
              placeholder="Add a caption..."
              multiline
              value={caption}
              onChangeText={setCaption}
            />

            <TouchableOpacity
              accessibilityLabel="Button"
              onPress={handleUpload}
              disabled={uploading}
              className="bg-primary p-4 rounded-xl items-center"
            >
              {uploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold">Upload to Portfolio</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
