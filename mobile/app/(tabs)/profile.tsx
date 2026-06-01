// File: mobile/app/(tabs)/profile.tsx
import {
  Settings,
  LogOut,
  ChevronRight,
  Shield,
  HelpCircle,
  Bell,
  Edit2,
  Briefcase,
  MessageCircle,
} from '@icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const MenuItem = ({ icon: Icon, title, value, onPress, destructive, rightElement }: any) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center p-4 bg-card rounded-2xl mb-2 border border-border"
    accessibilityLabel={title}
  >
    <View
      className={`w-10 h-10 rounded-full items-center justify-center ${destructive ? 'bg-destructive/10' : 'bg-primary/10'}`}
    >
      <Icon size={20} color={destructive ? '#C0392B' : '#1B5E3B'} />
    </View>
    <Text
      className={`ml-4 flex-1 font-semibold ${destructive ? 'text-destructive' : 'text-foreground'}`}
    >
      {title}
    </Text>
    {value && <Text className="text-muted-foreground text-sm mr-2">{value}</Text>}
    {rightElement ?? (!destructive && <ChevronRight size={18} color="#6B6B6B" />)}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { user, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(user?.fullName ?? '');
  const [editDistrict, setEditDistrict] = useState(user?.district ?? '');
  const [lang, setLang] = useState(user?.preferredLang ?? 'rw');

  const { data: freshProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/auth/users/me').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get('/bookings').then((r) => r.data),
    enabled: !!user,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: () =>
      api.patch(`/auth/users/${user?.id}/profile`, {
        full_name: editName,
        district: editDistrict,
        preferred_lang: lang,
      }),
    onSuccess: () => {
      updateUser({ fullName: editName, district: editDistrict, preferredLang: lang });
      setEditOpen(false);
      Toast.show({ type: 'success', text1: 'Profile updated!' });
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
    },
    onError: () => Toast.show({ type: 'error', text1: 'Update failed' }),
  });

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const completedJobs = bookings.filter((b: any) => b.status === 'completed').length;
  const activeJobs = bookings.filter((b: any) =>
    ['confirmed', 'in_progress', 'pending_payment'].includes(b.status),
  ).length;
  const unreadNotifs = notifications.filter((n: any) => !n.is_read).length;

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      {/* Profile header */}
      <View className="bg-primary pt-14 pb-8 px-6 items-center rounded-b-[40px]">
        <View className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden mb-3 bg-white/20">
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} className="w-full h-full" />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Text className="text-4xl font-black text-white">{user?.fullName?.[0] ?? '?'}</Text>
            </View>
          )}
        </View>
        <Text className="text-white text-2xl font-extrabold">{user?.fullName}</Text>
        <Text className="text-white/70 text-sm mt-0.5">{user?.email}</Text>
        <View className="mt-2 bg-white/20 px-3 py-1 rounded-full">
          <Text className="text-white text-xs font-bold uppercase">{user?.role}</Text>
        </View>

        {/* Quick stats */}
        <View className="flex-row gap-6 mt-5">
          <View className="items-center">
            <Text className="text-white text-xl font-extrabold">{completedJobs}</Text>
            <Text className="text-white/70 text-xs">Completed</Text>
          </View>
          <View className="w-px bg-white/20" />
          <View className="items-center">
            <Text className="text-white text-xl font-extrabold">{activeJobs}</Text>
            <Text className="text-white/70 text-xs">Active</Text>
          </View>
          <View className="w-px bg-white/20" />
          <View className="items-center">
            <Text className="text-white text-xl font-extrabold">{unreadNotifs}</Text>
            <Text className="text-white/70 text-xs">Unread</Text>
          </View>
        </View>
      </View>

      <View className="px-5 py-6">
        {/* Account section */}
        <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Account
        </Text>
        <MenuItem icon={Edit2} title="Edit Profile" onPress={() => setEditOpen(true)} />
        <MenuItem
          icon={Bell}
          title="Notifications"
          value={unreadNotifs > 0 ? `${unreadNotifs} unread` : 'All read'}
          onPress={() => router.push('/(tabs)/messages')}
        />
        <MenuItem
          icon={MessageCircle}
          title="Messages"
          onPress={() => router.push('/(tabs)/messages')}
        />
        {user?.role === 'artisan' && (
          <MenuItem
            icon={Briefcase}
            title="Artisan Dashboard"
            onPress={() => router.push('/(tabs)/pro')}
          />
        )}
        {user?.role === 'client' && (
          <MenuItem
            icon={Briefcase}
            title="My Bookings"
            value={`${bookings.length} total`}
            onPress={() => Toast.show({ type: 'info', text1: 'View your bookings in Messages' })}
          />
        )}

        {/* Security */}
        <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-5 mb-3">
          Security & Privacy
        </Text>
        <MenuItem
          icon={Shield}
          title="Verification Status"
          value={user?.accountStatus === 'active' ? '✅ Active' : '⏳ Pending'}
          onPress={() => {}}
        />

        {/* Language */}
        <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-5 mb-3">
          Language
        </Text>
        <View className="flex-row gap-2 mb-4">
          {(
            [
              ['rw', '🇷🇼 Kinyarwanda'],
              ['en', '🇬🇧 English'],
              ['fr', '🇫🇷 Français'],
            ] as const
          ).map(([code, label]) => (
            <TouchableOpacity
              key={code}
              onPress={() => {
                setLang(code);
                updateProfile.mutate();
              }}
              className={`flex-1 py-3 rounded-xl border-2 items-center ${lang === code ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text
                className={`text-xs font-semibold ${lang === code ? 'text-primary' : 'text-foreground'}`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Support */}
        <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-5 mb-3">
          Support
        </Text>
        <MenuItem
          icon={HelpCircle}
          title="Help Center"
          onPress={() =>
            Toast.show({
              type: 'info',
              text1: 'Help Center',
              text2: 'Contact: support@handyrwanda.rw',
            })
          }
        />
        <MenuItem icon={Settings} title="Settings" onPress={() => {}} />

        <View className="mt-4">
          <MenuItem icon={LogOut} title="Log Out" onPress={handleLogout} destructive />
        </View>

        <Text className="text-center text-muted-foreground text-xs mt-8 mb-4">
          HandyRwanda v2.0.0 · Made with ❤️ in Rwanda
        </Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={editOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditOpen(false)}
      >
        <View className="flex-1 bg-background p-5">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-extrabold">Edit Profile</Text>
            <TouchableOpacity
              onPress={() => setEditOpen(false)}
              className="p-2 bg-muted rounded-full"
            >
              <Text className="font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Full Name
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                className="bg-muted/50 p-4 rounded-2xl border border-border text-sm"
                placeholder="Your full name"
                autoCapitalize="words"
              />
            </View>
            <View className="mt-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                District
              </Text>
              <TextInput
                value={editDistrict}
                onChangeText={setEditDistrict}
                className="bg-muted/50 p-4 rounded-2xl border border-border text-sm"
                placeholder="e.g. Gasabo"
                autoCapitalize="words"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => updateProfile.mutate()}
            disabled={updateProfile.isPending || !editName.trim()}
            className="mt-8 bg-primary rounded-2xl py-4 items-center"
          >
            {updateProfile.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}
