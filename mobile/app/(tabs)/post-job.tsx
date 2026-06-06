// File: mobile/app/(tabs)/post-job.tsx
// This tab screen is a redirect shim. It immediately sends users into the
// (client)/post-job flow so the actual multi-step form lives in one place.
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useAuthStore } from '../../src/store/authStore';

export default function PostJobTab() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(client)/post-job');
    } else {
      // Not logged in — send to auth, then they'll come back here
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#1B5E3B" size="large" />
    </View>
  );
}
