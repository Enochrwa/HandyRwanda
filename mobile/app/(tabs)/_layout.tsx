// File: mobile/app/(tabs)/_layout.tsx
import { Home, Search, MessageCircle, User, LayoutDashboard, Bell, Plus } from '@icons';
import { useQuery } from '@tanstack/react-query';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useNotificationSocket } from '../../src/hooks/useNotificationSocket';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function TabsLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const isArtisan = user?.role === 'artisan';
  // const isClient = isAuthenticated && !isArtisan;

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

  // NOTE: Push token registration is handled centrally in app/_layout.tsx
  // (PushTokenRegistrar). We do NOT register here to avoid double-requesting
  // permissions, which causes an Android Activity restart → logout loop.

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

        {/* ── Post a Job tab — visible to clients and unauthenticated ── */}
        <Tabs.Screen
          name="post-job"
          options={{
            title: 'Post a Job',
            tabBarLabel: 'Post Job',
            tabBarIcon: ({ color, focused }) => (
              <View
                style={
                  focused
                    ? {
                        backgroundColor: '#1B5E3B',
                        borderRadius: 16,
                        padding: 6,
                        marginTop: -4,
                      }
                    : {}
                }
              >
                <Plus color={focused ? '#fff' : color} size={focused ? 26 : 22} />
              </View>
            ),
            tabBarLabelStyle: { fontWeight: '700' },
            // Hide for artisans — they don't post jobs
            href: isArtisan ? null : undefined,
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
