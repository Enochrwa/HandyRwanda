// File: mobile/app/_layout.tsx
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PermissionResponse } from 'expo-modules-core';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import '../src/global.css';
import { proService } from '../src/services/proService';
import { useAuthStore } from '../src/store/authStore';

// Configure notification handler so foreground notifications are shown
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Configure Android notification channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'HandyRwanda',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1B5E3B',
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Register push token when artisan logs in
function PushTokenRegistrar() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'artisan') return;

    (async () => {
      try {
        const { default: Notifications } = await import('expo-notifications');
        const { status } = (await Notifications.requestPermissionsAsync()) as PermissionResponse;
        if (status !== 'granted') return;
        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (tokenData?.data) {
          await proService.registerPushToken(tokenData.data);
        }
      } catch {
        // Silently ignore — push token registration is non-critical
      }
    })();
  }, [isAuthenticated, user?.role]);

  return null;
}

export default function RootLayout() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      // Notification received while app is foregrounded — handled by setNotificationHandler above
      console.log('[Notification received]', notification.request.content.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      // User tapped the notification — could navigate based on payload
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.booking_id || data?.job_id) {
        console.log('[Notification tapped]', data);
        // Navigation handled by expo-router deep links
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PushTokenRegistrar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
        <Toast />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
