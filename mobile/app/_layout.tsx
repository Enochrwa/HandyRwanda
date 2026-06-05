// File: mobile/app/_layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import '../src/global.css';
import { proService } from '../src/services/proService';
import { useAuthStore } from '../src/store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ── Push token registration & deep-link notification handler ─────────────────
function PushTokenRegistrar() {
  const { isAuthenticated, user } = useAuthStore();
  const notifListenerRef = useRef<{ remove: () => void } | null>(null);
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    (async () => {
      try {
        if (Platform.OS === 'web') return;

        const Notifications = await import('expo-notifications');

        // Set notification handler so foreground notifications show banners
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // Android: create default notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'HandyRwanda',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
          });
        }

        // Try FCM token first (preferred for native builds)
        let fcmRegistered = false;
        try {
          const { getMessaging, getToken } = await import('@react-native-firebase/messaging');
          const fcmToken = await getToken(getMessaging());
          if (fcmToken && mounted) {
            await proService.registerFCMToken(fcmToken);
            fcmRegistered = true;
          }
        } catch {
          // Firebase not available in Expo Go — fall through to Expo push
        }

        // Fallback to Expo push token
        if (!fcmRegistered && mounted) {
          try {
            const tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
            });
            if (tokenData?.data && mounted) {
              await proService.registerPushToken(tokenData.data);
            }
          } catch {
            // Non-critical — app works without push tokens
          }
        }

        // Handle notification taps when app is in background/closed
        if (mounted) {
          responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
            (response) => {
              const data = response.notification.request.content.data as Record<string, string>;
              handleNotificationDeepLink(data);
            },
          );

          // Refresh queries when a notification arrives in foreground
          notifListenerRef.current = Notifications.addNotificationReceivedListener(() => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
          });
        }
      } catch {
        // Silently ignore — push is non-critical
      }
    })();

    return () => {
      mounted = false;
      // Subscription objects have a .remove() method
      if (notifListenerRef.current) {
        notifListenerRef.current.remove();
        notifListenerRef.current = null;
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
        responseListenerRef.current = null;
      }
    };
  }, [isAuthenticated, user?.role]);

  return null;
}

/**
 * Deep-link router: navigate to the correct screen when a push notification
 * is tapped (app in background or closed).
 */
function handleNotificationDeepLink(data: Record<string, string>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { router } = require('expo-router') as {
      router: { push: (path: string) => void; replace: (path: string) => void };
    };
    const screen = data?.screen ?? data?.event_type;

    if (data?.booking_id) {
      router.push(`/messages/${data.booking_id}`);
    } else if (data?.job_id) {
      if (data?.role === 'artisan' || screen === 'artisan_jobs') {
        router.push(`/(artisan)/jobs/${data.job_id}`);
      } else {
        router.push(`/(client)/jobs/${data.job_id}`);
      }
    } else if (screen === 'artisan_earnings') {
      router.push('/(artisan)/earnings');
    } else if (screen === 'artisan_jobs') {
      router.push('/(artisan)/jobs');
    }
  } catch {
    // Navigation errors are non-fatal
  }
}

// ── Offline / foreground refresh ─────────────────────────────────────────────
function AppStateRefresher() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — refresh critical queries
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PushTokenRegistrar />
        <AppStateRefresher />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="auth"
            options={{
              headerShown: false,
              presentation: 'card',
            }}
          />
        </Stack>
        <StatusBar style="auto" />
        <Toast />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
