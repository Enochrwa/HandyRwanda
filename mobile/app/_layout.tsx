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

// ── Push token registration & deep-link notification handler ──────────────────
function PushTokenRegistrar() {
  const { isAuthenticated, user } = useAuthStore();
  const notifListenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');

        // Set notification handler so foreground notifications show banners
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
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

        // Android: create default channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'HandyRwanda',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
          });
        }

        // Get FCM token (preferred for native apps)
        let token: string | null = null;
        try {
          const { getMessaging, getToken } = await import('@react-native-firebase/messaging');
          token = await getToken(getMessaging());
          if (token) {
            await proService.registerFCMToken(token);
          }
        } catch {
          // Firebase not available — fallback to Expo push token
          try {
            const tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: 'YOUR_EAS_PROJECT_ID_HERE',
            });
            if (tokenData?.data) {
              await proService.registerPushToken(tokenData.data);
            }
          } catch {
            // Non-critical
          }
        }

        // Handle notification taps when app is in background/closed
        responseListenerRef.current =
          Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data as Record<string, string>;
            handleNotificationDeepLink(data);
          });

        // Handle foreground notifications
        notifListenerRef.current =
          Notifications.addNotificationReceivedListener((_notification) => {
            // Refresh queries to reflect new data
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
          });
      } catch {
        // Silently ignore
      }
    })();

    return () => {
      (async () => {
        try {
          const Notifications = await import('expo-notifications');
          if (notifListenerRef.current) {
            Notifications.removeNotificationSubscription(notifListenerRef.current);
          }
          if (responseListenerRef.current) {
            Notifications.removeNotificationSubscription(responseListenerRef.current);
          }
        } catch {}
      })();
    };
  }, [isAuthenticated, user?.role]);

  return null;
}

/**
 * Deep-link router: when a user taps a push notification, navigate
 * to the correct screen based on the notification data payload.
 */
function handleNotificationDeepLink(data: Record<string, string>) {
  try {
    const { router } = require('expo-router');
    const screen = data?.screen || data?.event_type;

    if (data?.booking_id) {
      router.push(`/messages/${data.booking_id}`);
    } else if (data?.job_id) {
      if (data?.role === 'artisan' || screen === 'artisan_jobs') {
        router.push(`/(artisan)/jobs/${data.job_id}`);
      } else {
        router.push(`/(client)/jobs/${data.job_id}`);
      }
    } else if (screen === 'artisan_earnings') {
      router.push('/(tabs)/pro');
    } else if (screen === 'artisan_jobs') {
      router.push('/(artisan)/jobs');
    }
  } catch {
    // Navigation errors are non-fatal
  }
}

// ── Offline indicator ─────────────────────────────────────────────────────────
function OfflineIndicator() {
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
        <OfflineIndicator />
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
