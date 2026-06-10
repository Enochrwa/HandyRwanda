// File: mobile/src/components/VoiceRecordButton.tsx
/**
 * Sprint 7 — Voice Messages: Microphone button + recording indicator.
 *
 * States:
 *   idle     → shows mic icon; long-press starts recording
 *   recording → shows pulsing red ring + elapsed time; release stops
 *   stopped  → hides (parent shows VoicePreviewCard instead)
 *
 * Usage:
 *   <VoiceRecordButton
 *     onStartRecording={startRecording}
 *     onStopRecording={stopRecording}
 *     isRecording={state === 'recording'}
 *     elapsedSecs={elapsedSecs}
 *   />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  StyleSheet,
} from 'react-native';
import { Mic } from 'lucide-react-native';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Pulsing ring animation ────────────────────────────────────────────────

function PulsingRing() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.7,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: 24,
          backgroundColor: '#EF4444',
          transform: [{ scale }],
          opacity,
        },
      ]}
      pointerEvents="none"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface VoiceRecordButtonProps {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  elapsedSecs: number;
  disabled?: boolean;
}

export function VoiceRecordButton({
  onStartRecording,
  onStopRecording,
  isRecording,
  elapsedSecs,
  disabled = false,
}: VoiceRecordButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
    onStartRecording();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    if (isRecording) onStopRecording();
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Elapsed time above button while recording */}
      {isRecording && (
        <View
          style={{
            position: 'absolute',
            top: -22,
            backgroundColor: '#EF4444',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
            ● {formatElapsed(elapsedSecs)}
          </Text>
        </View>
      )}

      <Animated.View
        style={{
          width: 48,
          height: 48,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {isRecording && <PulsingRing />}
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={0.8}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: isRecording ? '#EF4444' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
              ios: {
                shadowColor: isRecording ? '#EF4444' : '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              },
              android: {
                elevation: isRecording ? 6 : 2,
              },
            }),
          }}
          accessibilityLabel={isRecording ? 'Release to send voice message' : 'Hold to record voice message'}
          accessibilityHint="Long press to start recording, release to stop"
        >
          <Mic size={20} color={isRecording ? '#fff' : '#6B7280'} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
