// File: mobile/src/components/OfflineBanner.tsx
/**
 * Offline indicator banner shown at the top of the screen when
 * the device has no internet connection.
 * Animates in/out and informs the user they are viewing cached data.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useOfflineStatus } from '../hooks/useOfflineCache';

export function OfflineBanner() {
  const { isOnline } = useOfflineStatus();
  const slideAnim = useRef(new Animated.Value(isOnline ? -50 : 0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOnline ? -50 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [isOnline]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <View style={styles.inner}>
        <Text style={styles.dot}>⚠</Text>
        <Text style={styles.text}>You're offline — showing cached data</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  dot: {
    fontSize: 14,
  },
  text: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
