import { Settings, LogOut, ChevronRight, User, Shield, HelpCircle, Bell } from '@icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';

import { useAuthStore } from '../../src/store/authStore';

const MenuItem = ({ icon: Icon, title, onPress, destructive }: any) => (
  <TouchableOpacity
    accessibilityLabel="Button"
    onPress={onPress}
    className="flex-row items-center p-4 bg-card rounded-2xl mb-2 border border-border"
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
    {!destructive && <ChevronRight size={18} color="#6B6B6B" />}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background p-6">
      <View className="items-center mb-8">
        <View className="w-24 h-24 rounded-full bg-muted border-4 border-white shadow-sm overflow-hidden mb-4">
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} className="w-full h-full" />
          ) : (
            <View className="w-full h-full items-center justify-center bg-primary/10">
              <User size={48} color="#1B5E3B" />
            </View>
          )}
        </View>
        <Text className="text-2xl font-bold">{user?.fullName}</Text>
        <Text className="text-muted-foreground">{user?.email}</Text>
        <View className="mt-2 bg-primary/10 px-3 py-1 rounded-full">
          <Text className="text-primary font-bold text-xs uppercase">{user?.role}</Text>
        </View>
      </View>

      <View className="mb-8">
        <Text className="text-lg font-bold mb-4">Account</Text>
        <MenuItem icon={User} title="Edit Profile" />
        <MenuItem icon={Bell} title="Notifications" />
        <MenuItem icon={Shield} title="Security" />
      </View>

      <View className="mb-8">
        <Text className="text-lg font-bold mb-4">Support</Text>
        <MenuItem icon={HelpCircle} title="Help Center" />
        <MenuItem icon={Settings} title="Settings" />
      </View>

      <MenuItem icon={LogOut} title="Log Out" onPress={handleLogout} destructive />

      <View className="items-center mt-10 mb-20">
        <Text className="text-muted-foreground text-xs">HandyRwanda v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
