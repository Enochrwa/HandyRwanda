// File: mobile/app/(client)/post-job/confirm.tsx
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../../src/services/api';
import { uploadImage } from '../../../src/services/imageUpload';

function formatRWF(n: number) {
  return new Intl.NumberFormat('rw-RW').format(n);
}

const URGENCY_LABELS: Record<string, string> = {
  flexible: '📅 Flexible (within 2 weeks)',
  this_week: '🗓️ This Week (within 7 days)',
  tomorrow: '⏰ Tomorrow (within 24h)',
  today: '🔥 Today',
  urgent: '🚨 Urgent (within 2 hours)',
};

export default function ConfirmJob() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<Record<string, string>>();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const { data: allCategories = [] } = useQuery<
    { id: string; name_en: string; icon_emoji?: string }[]
  >({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });
  const category = allCategories.find((c) => c.id === params.categoryId) ?? null;

  const budget = params.budget ? parseInt(params.budget, 10) : null;
  // photos are now stored as local file URIs (not base64)
  const photoUris: string[] = JSON.parse(params.photos ?? '[]');

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Upload photos via presigned URLs (not base64 in body)
      const uploadedPhotoUrls: string[] = [];
      if (photoUris.length > 0) {
        setUploadProgress('Uploading photos…');
        for (let i = 0; i < photoUris.length; i++) {
          const uri = photoUris[i];
          setUploadProgress(`Uploading photo ${i + 1} of ${photoUris.length}…`);
          try {
            const result = await uploadImage(uri, 'job_photo', true, `job_photo_${i}.jpg`);
            uploadedPhotoUrls.push(result.publicUrl);
          } catch {
            Toast.show({
              type: 'info',
              text1: `Photo ${i + 1} skipped`,
              text2: 'Continuing without it',
            });
          }
        }
      }

      setUploadProgress('Posting job…');
      // Parse structured address passed from location step
      let parsedAddress: Record<string, string> | undefined;
      try {
        parsedAddress = params.addressJson ? JSON.parse(params.addressJson) : undefined;
      } catch {
        parsedAddress = undefined;
      }

      const jobData: Record<string, unknown> = {
        category_id: params.categoryId,
        title: params.title,
        description: params.description,
        additional_notes: params.additionalNotes || undefined,
        latitude: parseFloat(params.latitude ?? '-1.9441'),
        longitude: parseFloat(params.longitude ?? '30.0619'),
        location_label: params.locationLabel ?? 'Custom Location',
        urgency: params.urgency ?? 'flexible',
        budget_negotiable: params.budgetNegotiable === '1',
        ...(parsedAddress && parsedAddress.district ? { address: parsedAddress } : {}),
        ...(params.scheduledTime ? { scheduled_time: params.scheduledTime } : {}),
        ...(budget ? { budget } : {}),
        ...(uploadedPhotoUrls.length > 0 ? { photos_urls: uploadedPhotoUrls } : {}),
      };

      await api.post('/jobs', jobData);
      await qc.invalidateQueries({ queryKey: ['my-jobs'] });

      Toast.show({
        type: 'success',
        text1: '🎉 Job Posted!',
        text2: 'Artisans will start bidding shortly.',
      });
      router.replace('/(tabs)/search');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      Toast.show({
        type: 'error',
        text1: 'Failed to post job',
        text2: typeof msg === 'string' ? msg : 'Please try again.',
      });
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const summaryRows = [
    {
      label: 'Service Category',
      value: category?.name_en ?? 'Loading...',
      icon: category?.icon_emoji ?? '🛠️',
    },
    { label: 'Title', value: params.title },
    { label: 'Urgency', value: URGENCY_LABELS[params.urgency ?? 'flexible'] },
    {
      label: 'Budget',
      value: budget
        ? `${formatRWF(budget)} RWF${params.budgetNegotiable === '1' ? ' (negotiable)' : ''}`
        : 'Open to bids',
    },
    {
      label: 'Location',
      value:
        params.locationLabel ??
        `${parseFloat(params.latitude ?? '0').toFixed(4)}, ${parseFloat(params.longitude ?? '0').toFixed(4)}`,
    },
    ...(params.scheduledTime
      ? [
          {
            label: 'Scheduled',
            value: new Date(params.scheduledTime).toLocaleString('en-RW', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]
      : []),
    {
      label: 'Photos',
      value:
        photoUris.length > 0
          ? `${photoUris.length} photo${photoUris.length > 1 ? 's' : ''} attached`
          : 'None',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View
        style={{
          paddingTop: 56,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Review & Post</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          Step 3 of 3 — Confirm your job details
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 4 }}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#1B5E3B',
                marginRight: 4,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          {summaryRows.map(({ label, value, icon }, i) => (
            <View
              key={label}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: i < summaryRows.length - 1 ? 1 : 0,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 2,
                }}
              >
                {icon ? `${icon}  ` : ''}
                {label}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{value}</Text>
            </View>
          ))}
        </View>

        {params.description ? (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: '#9CA3AF',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Description
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>
              {params.description}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: '#F0FDF4',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#BBF7D0',
            padding: 14,
            marginBottom: 32,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803D', marginBottom: 4 }}>
            📋 What happens next?
          </Text>
          <Text style={{ fontSize: 12, color: '#4B7C5A', lineHeight: 18 }}>
            Verified artisans matching your category will be notified and submit bids. Compare
            profiles, ratings, and prices before accepting.
          </Text>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          paddingTop: 12,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          gap: 10,
        }}
      >
        {uploadProgress ? (
          <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
            {uploadProgress}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Text style={{ fontWeight: '700', color: '#374151' }}>← Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              flex: 2,
              backgroundColor: '#1B5E3B',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                Post Job — Free ✓
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
