// File: mobile/app/(artisan)/profile/portfolio.tsx
/**
 * Sprint 10 — Artisan Portfolio Screen (Photos + Skill Videos)
 *
 * Tabbed interface:
 *   📸 Photos  — existing portfolio photo grid (unchanged flow)
 *   🎬 Videos  — skill verification videos with upload, review status & playback
 *
 * Video tab highlights:
 *   • Record or pick from gallery (≤60 s, expo-image-picker mediaTypes: ["videos"])
 *   • Presigned upload → POST /artisans/me/skill-videos
 *   • Pending badge, approved view count, rejected reason shown per card
 *   • In-list preview using expo-av Video component
 *   • Max 5 videos enforced (mirrors backend guard)
 */

import { Plus, X, Trash2, PlayCircle, Eye, Clock, CheckCircle2, XCircle, Video as VideoIcon, Camera } from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import React, { useState, useRef, useCallback } from 'react';
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
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';
import { uploadSkillVideo } from '../../../src/services/videoUpload';
// imageUpload imported but not needed — photo upload uses base64 inline

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioPhoto {
  id: string;
  image_url: string;
  job_type?: string;
  description?: string;
  created_at: string;
}

interface SkillVideo {
  id: string;
  artisan_id: string;
  category_id?: string;
  category_name?: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  duration_seconds?: number;
  is_approved: boolean;
  rejection_reason?: string;
  view_count: number;
  created_at: string;
}

interface Category {
  id: string;
  name_en: string;
  icon_emoji?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function VideoStatusBadge({ video }: { video: SkillVideo }) {
  if (video.is_approved) {
    return (
      <View className="flex-row items-center gap-1 bg-emerald-500/90 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={10} color="white" />
        <Text className="text-white text-[9px] font-bold">LIVE</Text>
      </View>
    );
  }
  if (video.rejection_reason) {
    return (
      <View className="flex-row items-center gap-1 bg-red-500/90 px-2 py-0.5 rounded-full">
        <XCircle size={10} color="white" />
        <Text className="text-white text-[9px] font-bold">REJECTED</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1 bg-amber-500/90 px-2 py-0.5 rounded-full">
      <Clock size={10} color="white" />
      <Text className="text-white text-[9px] font-bold">REVIEW</Text>
    </View>
  );
}

// ── Video Card Component ───────────────────────────────────────────────────────

function VideoCard({
  video,
  onDelete,
  onPlay,
}: {
  video: SkillVideo;
  onDelete: (id: string) => void;
  onPlay: (video: SkillVideo) => void;
}) {
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
      {/* Thumbnail / Play area */}
      <Pressable onPress={() => onPlay(video)} className="relative">
        {video.thumbnail_url ? (
          <Image
            source={{ uri: video.thumbnail_url }}
            className="w-full aspect-video bg-muted"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full aspect-video bg-muted items-center justify-center">
            <VideoIcon size={40} color="#9CA3AF" />
          </View>
        )}
        {/* Play overlay */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-14 h-14 bg-black/50 rounded-full items-center justify-center">
            <PlayCircle size={32} color="white" />
          </View>
        </View>
        {/* Status badge */}
        <View className="absolute top-2 left-2">
          <VideoStatusBadge video={video} />
        </View>
        {/* Duration */}
        {video.duration_seconds && (
          <View className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 rounded">
            <Text className="text-white text-[10px] font-mono">
              {formatDuration(video.duration_seconds)}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Info */}
      <View className="p-3">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-2">
            <Text className="font-bold text-sm" numberOfLines={1}>
              {video.title}
            </Text>
            {video.category_name && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                {video.category_name}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Delete Video', 'Remove this skill video from your profile?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => onDelete(video.id),
                },
              ])
            }
            className="p-1.5 bg-red-50 rounded-full border border-red-100"
          >
            <Trash2 size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* View count for approved */}
        {video.is_approved && (
          <View className="flex-row items-center gap-1 mt-2">
            <Eye size={12} color="#6B7280" />
            <Text className="text-xs text-muted-foreground">
              {video.view_count.toLocaleString()} views
            </Text>
          </View>
        )}

        {/* Rejection reason */}
        {video.rejection_reason && (
          <View className="mt-2 bg-red-50 border border-red-100 rounded-xl p-2.5">
            <Text className="text-xs font-bold text-red-700 mb-0.5">Rejection reason:</Text>
            <Text className="text-xs text-red-600">{video.rejection_reason}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos');

  // Photo upload state
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  // Video upload state
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | undefined>();
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<string>('');

  // Video player state
  const [playingVideo, setPlayingVideo] = useState<SkillVideo | null>(null);
  const videoRef = useRef<Video>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: photos, isLoading: photosLoading } = useQuery<PortfolioPhoto[]>({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/artisans/portfolio/me').then((r) => r.data),
  });

  const { data: myVideos, isLoading: videosLoading } = useQuery<SkillVideo[]>({
    queryKey: ['my-skill-videos'],
    queryFn: () => api.get('/artisans/me/skill-videos').then((r) => r.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/artisans/categories').then((r) => r.data),
  });

  // ── Photo mutations ───────────────────────────────────────────────────────────

  const photoUploadMutation = useMutation({
    mutationFn: async (data: { photo_base64: string; description: string }) =>
      api.post('/artisans/portfolio', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setPhotoModalVisible(false);
      setSelectedImage(null);
      setPhotoUri(null);
      setCaption('');
      Toast.show({ type: 'success', text1: 'Photo added to portfolio!' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Upload failed' }),
    onSettled: () => setPhotoUploading(false),
  });

  const deletPhotoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/artisans/portfolio/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      Toast.show({ type: 'success', text1: 'Photo removed' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Delete failed' }),
  });

  // ── Video mutations ───────────────────────────────────────────────────────────

  const deleteVideoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/artisans/me/skill-videos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-skill-videos'] });
      Toast.show({ type: 'success', text1: 'Video removed' });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Delete failed' }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].base64 ?? null);
      setPhotoModalVisible(true);
    }
  };

  const handlePhotoUpload = () => {
    if (!selectedImage) return;
    setPhotoUploading(true);
    photoUploadMutation.mutate({ photo_base64: selectedImage, description: caption });
  };

  const pickVideo = async () => {
    // Check limit
    if (myVideos && myVideos.length >= 5) {
      Alert.alert(
        'Video limit reached',
        'You can have a maximum of 5 skill videos. Delete one to add a new video.',
      );
      return;
    }

    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera roll access to pick a video.');
      return;
    }

    Alert.alert('Add Skill Video', 'Choose how to add your skill video', [
      {
        text: 'Record Video (60 sec max)',
        onPress: () => launchVideoPicker('camera'),
      },
      {
        text: 'Pick from Gallery',
        onPress: () => launchVideoPicker('library'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const launchVideoPicker = async (source: 'camera' | 'library') => {
    let result;
    if (source === 'camera') {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (camPerm.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to record a video.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        videoMaxDuration: 60,
        quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: Platform.OS === 'ios',
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        videoMaxDuration: 60,
        quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: Platform.OS === 'ios',
      });
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setVideoUri(asset.uri);
      setVideoDuration(
        asset.duration ? Math.round(asset.duration / 1000) : undefined,
      );
      setVideoTitle('');
      setVideoDescription('');
      setSelectedCategoryId(undefined);
      setVideoModalVisible(true);
    }
  };

  const handleVideoUpload = async () => {
    if (!videoUri) return;
    const title = videoTitle.trim();
    if (!title) {
      Toast.show({ type: 'error', text1: 'Please add a title for your video' });
      return;
    }

    setVideoUploading(true);
    setVideoUploadProgress('Preparing upload…');
    try {
      setVideoUploadProgress('Uploading video to storage…');
      const { publicUrl } = await uploadSkillVideo(videoUri, videoDuration);

      setVideoUploadProgress('Saving video details…');
      await api.post('/artisans/me/skill-videos', {
        video_url: publicUrl,
        title: title.slice(0, 100),
        description: videoDescription.trim().slice(0, 300) || undefined,
        duration_seconds: videoDuration,
        category_id: selectedCategoryId ?? undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['my-skill-videos'] });
      setVideoModalVisible(false);
      setVideoUri(null);
      setVideoTitle('');
      setVideoDescription('');
      Toast.show({
        type: 'success',
        text1: '🎬 Video submitted!',
        text2: 'Under review — usually approved within 24 hours.',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2: err?.message ?? 'Please try again',
      });
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress('');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const isLoading = activeTab === 'photos' ? photosLoading : videosLoading;
  const approvedCount = myVideos?.filter((v) => v.is_approved).length ?? 0;
  const pendingCount = myVideos?.filter((v) => !v.is_approved && !v.rejection_reason).length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-extrabold tracking-tight">Portfolio</Text>
        <Text className="text-muted-foreground text-sm mt-0.5">
          Showcase your work and skill videos
        </Text>
      </View>

      {/* Tab Switcher */}
      <View className="flex-row px-5 mb-4 gap-2">
        {(['photos', 'videos'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl items-center border-2 ${
              activeTab === tab
                ? 'border-primary bg-primary'
                : 'border-border bg-card'
            }`}
          >
            <Text
              className={`font-bold text-sm ${
                activeTab === tab ? 'text-white' : 'text-foreground'
              }`}
            >
              {tab === 'photos' ? `📸 Photos` : `🎬 Videos`}
              {tab === 'videos' && myVideos && myVideos.length > 0
                ? ` (${myVideos.length})`
                : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1B5E3B" size="large" />
        </View>
      )}

      {/* ── PHOTOS TAB ─────────────────────────────────────────────────────── */}
      {!isLoading && activeTab === 'photos' && (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <View className="px-5 mb-4 flex-row justify-end">
              <TouchableOpacity
                onPress={pickPhoto}
                className="flex-row items-center gap-2 bg-primary px-4 py-2.5 rounded-xl"
              >
                <Plus size={16} color="white" />
                <Text className="text-white font-bold text-sm">Add Photo</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() =>
                Alert.alert('Delete Photo', 'Remove this photo?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deletPhotoMutation.mutate(item.id),
                  },
                ])
              }
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
                onPress={() =>
                  Alert.alert('Delete Photo', 'Remove this photo?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deletPhotoMutation.mutate(item.id),
                    },
                  ])
                }
                className="absolute top-2 right-2 bg-black/40 p-1.5 rounded-full"
              >
                <Trash2 size={12} color="white" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center mt-16 mx-5 border-2 border-dashed border-border p-10 rounded-3xl">
              <Camera size={40} color="#9CA3AF" />
              <Text className="text-muted-foreground text-center mt-3 font-medium">
                No portfolio photos yet.
              </Text>
              <Text className="text-muted-foreground text-center text-sm mt-1">
                Add photos to showcase your best work to clients.
              </Text>
            </View>
          }
        />
      )}

      {/* ── VIDEOS TAB ─────────────────────────────────────────────────────── */}
      {!isLoading && activeTab === 'videos' && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          {myVideos && myVideos.length > 0 && (
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-3 items-center">
                <Text className="text-2xl font-extrabold text-emerald-700">{approvedCount}</Text>
                <Text className="text-xs text-emerald-600 font-medium mt-0.5">Live</Text>
              </View>
              <View className="flex-1 bg-amber-50 border border-amber-100 rounded-2xl p-3 items-center">
                <Text className="text-2xl font-extrabold text-amber-700">{pendingCount}</Text>
                <Text className="text-xs text-amber-600 font-medium mt-0.5">In Review</Text>
              </View>
              <View className="flex-1 bg-muted/60 border border-border rounded-2xl p-3 items-center">
                <Text className="text-2xl font-extrabold">{5 - (myVideos.length)}</Text>
                <Text className="text-xs text-muted-foreground font-medium mt-0.5">Slots Left</Text>
              </View>
            </View>
          )}

          {/* Add video button */}
          <TouchableOpacity
            onPress={pickVideo}
            disabled={(myVideos?.length ?? 0) >= 5}
            className={`flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border-2 mb-4 ${
              (myVideos?.length ?? 0) >= 5
                ? 'border-border bg-muted/50 opacity-50'
                : 'border-primary bg-primary/10 border-dashed'
            }`}
          >
            <VideoIcon size={18} color={(myVideos?.length ?? 0) >= 5 ? '#9CA3AF' : '#1B5E3B'} />
            <Text
              className={`font-bold ${
                (myVideos?.length ?? 0) >= 5 ? 'text-muted-foreground' : 'text-primary'
              }`}
            >
              {(myVideos?.length ?? 0) >= 5
                ? 'Maximum 5 videos reached'
                : '+ Add Skill Video (60 sec max)'}
            </Text>
          </TouchableOpacity>

          {/* Trust banner */}
          {(!myVideos || myVideos.length === 0) && (
            <View className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4">
              <Text className="font-bold text-primary mb-1">🎬 Why add skill videos?</Text>
              <Text className="text-sm text-foreground/70 leading-relaxed">
                Artisans with approved skill videos get{' '}
                <Text className="font-bold text-primary">3× more profile views</Text>. Clients
                trust what they can see. Show a 60-second clip of you solving a real problem.
              </Text>
            </View>
          )}

          {/* Video cards */}
          {myVideos?.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={(id) => deleteVideoMutation.mutate(id)}
              onPlay={(v) => setPlayingVideo(v)}
            />
          ))}

          {myVideos?.length === 0 && (
            <View className="items-center justify-center mt-8 border-2 border-dashed border-border p-10 rounded-3xl">
              <VideoIcon size={40} color="#9CA3AF" />
              <Text className="text-muted-foreground text-center mt-3 font-medium">
                No skill videos yet.
              </Text>
              <Text className="text-muted-foreground text-center text-sm mt-1">
                Record a 60-second clip demonstrating your craft to build trust with clients.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Photo Upload Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={photoModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-[40px] p-6 pb-10">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold">Add Portfolio Photo</Text>
              <TouchableOpacity onPress={() => setPhotoModalVisible(false)}>
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
              placeholder="Add a caption…"
              multiline
              value={caption}
              onChangeText={setCaption}
            />
            <TouchableOpacity
              onPress={handlePhotoUpload}
              disabled={photoUploading}
              className="bg-primary p-4 rounded-xl items-center"
            >
              {photoUploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold">Upload to Portfolio</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Video Upload Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={videoModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !videoUploading && setVideoModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-background">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-extrabold">Add Skill Video</Text>
                <Text className="text-sm text-muted-foreground mt-0.5">
                  Show clients what you can do
                </Text>
              </View>
              {!videoUploading && (
                <TouchableOpacity
                  onPress={() => setVideoModalVisible(false)}
                  className="p-2 bg-muted rounded-full"
                >
                  <X size={20} color="#1A1A1A" />
                </TouchableOpacity>
              )}
            </View>

            {/* Video preview placeholder */}
            <View className="w-full aspect-video bg-muted rounded-2xl items-center justify-center mb-5 border-2 border-dashed border-border">
              {videoUri ? (
                <View className="items-center gap-2">
                  <PlayCircle size={48} color="#1B5E3B" />
                  <Text className="text-sm text-primary font-medium">Video selected</Text>
                  {videoDuration && (
                    <Text className="text-xs text-muted-foreground">
                      Duration: {formatDuration(videoDuration)}
                    </Text>
                  )}
                </View>
              ) : (
                <View className="items-center gap-2">
                  <VideoIcon size={40} color="#9CA3AF" />
                  <Text className="text-sm text-muted-foreground">No video selected</Text>
                </View>
              )}
            </View>

            {/* Title */}
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Video Title *
            </Text>
            <TextInput
              value={videoTitle}
              onChangeText={setVideoTitle}
              placeholder="e.g. Fixing a leaking pipe in 5 steps"
              maxLength={100}
              className="bg-muted/60 p-4 rounded-xl border border-border mb-4 text-sm"
              editable={!videoUploading}
            />

            {/* Description */}
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Description (optional)
            </Text>
            <TextInput
              value={videoDescription}
              onChangeText={setVideoDescription}
              placeholder="Briefly describe the skill or task shown…"
              multiline
              numberOfLines={3}
              maxLength={300}
              className="bg-muted/60 p-4 rounded-xl border border-border mb-4 text-sm"
              style={{ textAlignVertical: 'top', minHeight: 80 }}
              editable={!videoUploading}
            />

            {/* Category */}
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Skill Category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              <View className="flex-row gap-2">
                {categories?.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() =>
                      setSelectedCategoryId(
                        selectedCategoryId === cat.id ? undefined : cat.id,
                      )
                    }
                    disabled={videoUploading}
                    className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                      selectedCategoryId === cat.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    {cat.icon_emoji && <Text>{cat.icon_emoji}</Text>}
                    <Text
                      className={`text-xs font-semibold ${
                        selectedCategoryId === cat.id ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {cat.name_en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Tips */}
            <View className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 mb-6">
              <Text className="text-xs font-bold text-blue-800 mb-1">📋 Review guidelines</Text>
              <Text className="text-xs text-blue-700 leading-relaxed">
                • Clearly show the skill or task being performed{'\n'}
                • Good lighting and steady camera improves approval rate{'\n'}
                • Max 60 seconds — focus on the key technique{'\n'}
                • Admin review usually takes less than 24 hours
              </Text>
            </View>

            {/* Upload progress */}
            {videoUploading && videoUploadProgress && (
              <View className="bg-primary/10 rounded-xl px-4 py-3 mb-4 flex-row items-center gap-3">
                <ActivityIndicator color="#1B5E3B" size="small" />
                <Text className="text-sm text-primary font-medium flex-1">
                  {videoUploadProgress}
                </Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleVideoUpload}
              disabled={!videoUri || !videoTitle.trim() || videoUploading}
              className={`py-4 rounded-2xl items-center ${
                !videoUri || !videoTitle.trim() || videoUploading
                  ? 'bg-muted'
                  : 'bg-primary'
              }`}
            >
              {videoUploading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="white" size="small" />
                  <Text className="text-white font-bold">Uploading…</Text>
                </View>
              ) : (
                <Text
                  className={`font-bold text-base ${
                    !videoUri || !videoTitle.trim() ? 'text-muted-foreground' : 'text-white'
                  }`}
                >
                  Submit for Review ✓
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Video Playback Modal ──────────────────────────────────────────── */}
      <Modal
        visible={!!playingVideo}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setPlayingVideo(null)}
      >
        <View className="flex-1 bg-black">
          {/* Header */}
          <SafeAreaView>
            <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
              <View className="flex-1">
                <Text className="text-white font-bold text-base" numberOfLines={1}>
                  {playingVideo?.title}
                </Text>
                {playingVideo?.category_name && (
                  <Text className="text-white/60 text-xs mt-0.5">{playingVideo.category_name}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  videoRef.current?.pauseAsync();
                  setPlayingVideo(null);
                }}
                className="p-2 bg-white/10 rounded-full ml-3"
              >
                <X size={20} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Video player */}
          {playingVideo && (
            <Video
              ref={videoRef}
              source={{ uri: playingVideo.video_url }}
              style={{ flex: 1 }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              onPlaybackStatusUpdate={async (status) => {
                // Track view count when playback starts
                if (status.isLoaded && status.isPlaying && status.positionMillis < 1500) {
                  try {
                    await api.post(`/artisans/skill-videos/${playingVideo.id}/view`);
                  } catch {
                    // Fire-and-forget — view count failure is non-critical
                  }
                }
              }}
            />
          )}

          {/* Video info */}
          <SafeAreaView>
            <View className="px-4 pt-3 pb-4">
              {playingVideo?.description && (
                <Text className="text-white/80 text-sm leading-relaxed">
                  {playingVideo.description}
                </Text>
              )}
              <View className="flex-row items-center gap-4 mt-2">
                <View className="flex-row items-center gap-1">
                  <Eye size={14} color="rgba(255,255,255,0.6)" />
                  <Text className="text-white/60 text-xs">
                    {(playingVideo?.view_count ?? 0).toLocaleString()} views
                  </Text>
                </View>
                {playingVideo?.duration_seconds && (
                  <View className="flex-row items-center gap-1">
                    <Clock size={14} color="rgba(255,255,255,0.6)" />
                    <Text className="text-white/60 text-xs">
                      {formatDuration(playingVideo.duration_seconds)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
