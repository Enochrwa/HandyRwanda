// File: mobile/app/(tabs)/_layout.tsx
import { Home, Search, MessageCircle, User, LayoutDashboard } from '@icons';
import * as Notifications from 'expo-notifications';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, TouchableOpacity, Text } from 'react-native';

import { proService } from '../../src/services/proService';
import { useAuthStore } from '../../src/store/authStore';

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== 'granted') return null;
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export default function TabsLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  const isArtisan = user?.role === 'artisan';

  // Register push token after artisan logs in
  useEffect(() => {
    if (!isAuthenticated || !isArtisan) return;
    registerForPushNotifications()
      .then((token) => {
        if (token) return proService.registerPushToken(token);
      })
      .catch(() => {
        // Non-fatal — app works without push tokens
      });
  }, [isAuthenticated, isArtisan]);

  return (
    <Tabs
      screenOptions={{
        lazy: true,
        headerShown: true,
        tabBarActiveTintColor: '#1B5E3B',
        tabBarInactiveTintColor: '#6B6B6B',
        tabBarStyle: { borderTopColor: '#E2E8F0' },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: '700', color: '#1A1A1A' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HandyRwanda',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
          headerRight: () =>
            !isAuthenticated ? (
              <TouchableOpacity
                accessibilityLabel="Log in"
                onPress={() => router.push('/auth')}
                className="mr-4 px-3 py-1.5 bg-primary rounded-full"
              >
                <Text className="text-white text-xs font-bold">Log in</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Find Artisans',
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => <Search color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} />,
          href: isAuthenticated ? undefined : null,
        }}
      />
      {/* Pro dashboard — always declared, hidden unless artisan */}
      <Tabs.Screen
        name="pro"
        options={{
          title: 'Pro Dashboard',
          tabBarLabel: 'Pro',
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} />,
          href: isAuthenticated && isArtisan ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
          href: isAuthenticated ? undefined : null,
        }}
      />
    </Tabs>
  );
}
