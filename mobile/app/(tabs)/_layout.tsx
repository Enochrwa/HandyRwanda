// File: mobile/app/(tabs)/_layout.tsx
import { Home, Search, MessageCircle, User, LayoutDashboard, Bell } from '@icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, TouchableOpacity, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import api from '../../src/services/api';
import { proService } from '../../src/services/proService';
import { useAuthStore } from '../../src/store/authStore';
import { useNotificationSocket } from '../../src/hooks/useNotificationSocket';
import { OfflineBanner } from '../../src/components/OfflineBanner';

export default function TabsLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const isArtisan = user?.role === 'artisan';

  // Real-time WebSocket notifications (replaces polling)
  useNotificationSocket();

  // Unread notification count for badge
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const unreadCount = (notifications as any[]).filter((n) => !n.is_read).length;

  // Register FCM + Expo push tokens after login
  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      try {
        if (Platform.OS === 'web') return;

        // Try FCM first (preferred on native)
        try {
          const { getMessaging, getToken } = await import('@react-native-firebase/messaging');
          const messaging = getMessaging();
          const fcmToken = await getToken(messaging);
          if (fcmToken) {
            await proService.registerFCMToken(fcmToken);
            return; // FCM registered — skip Expo token
          }
        } catch {
          // Firebase not available (Expo Go) — fall through to Expo token
        }

        // Fallback: Expo push token
        const Notifications = await import('expo-notifications');
        const { status: existing } = await Notifications.getPermissionsAsync();
        const finalStatus =
          existing === 'granted'
            ? existing
            : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
        });
        if (tokenData?.data) {
          await proService.registerPushToken(tokenData.data);
        }
      } catch {
        // Non-fatal — app works without push tokens
      }
    })();
  }, [isAuthenticated]);

  // Onboarding gate: artisans without profiles go to onboarding
  useEffect(() => {
    if (!isAuthenticated || !isArtisan) return;
    api
      .get('/artisans/profile/me')
      .then((r) => {
        const profile = r.data;
        if (!profile?.bio || !profile?.skills?.length) {
          router.replace('/(artisan)/onboarding/step1-bio');
        }
      })
      .catch(() => {
        router.replace('/(artisan)/onboarding/step1-bio');
      });
  }, [isAuthenticated, isArtisan, router]);

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
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
                  style={{
                    marginRight: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: '#1B5E3B',
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Log in</Text>
                </TouchableOpacity>
              ) : (
                // Notification bell in header
                <TouchableOpacity
                  onPress={() => router.push('/notifications')}
                  style={{ marginRight: 16 }}
                  accessibilityLabel={`${unreadCount} unread notifications`}
                >
                  <View>
                    <Bell size={22} color="#1A1A1A" />
                    {unreadCount > 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -6,
                          backgroundColor: '#EF4444',
                          borderRadius: 8,
                          minWidth: 16,
                          height: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ),
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
    </View>
  );
}
