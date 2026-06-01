// File: mobile/app/_layout.tsx
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PushTokenRegistrar />
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
