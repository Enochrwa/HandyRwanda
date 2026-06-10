// File: mobile/src/components/VoiceMessageBubble.tsx
/**
 * Sprint 7 — Voice Message playback bubble.
 *
 * Renders inside the chat message list when a message has voice_note_url.
 * Replaces the normal text bubble for voice-only messages.
 *
 * Design:
 *   - Matches existing chat bubble styling (primary for me, muted for others)
 *   - Animated waveform bars (decorative, performant — no audio analysis needed)
 *   - Play/Pause button with loading spinner
 *   - Duration counter: shows total initially, live position while playing
 *   - Respects autoplay-off policy (Rwanda data costs)
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Pause, Play } from 'lucide-react-native';

import { useAudioPlayer } from '../hooks/useAudioPlayer';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSecs = Math.round(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── Waveform bars component ───────────────────────────────────────────────

/** Static decorative waveform — 18 bars with fixed heights. */
const WAVEFORM_HEIGHTS = [6, 10, 14, 18, 22, 16, 10, 14, 20, 24, 18, 12, 16, 22, 14, 10, 8, 12];

interface WaveformProps {
  isPlaying: boolean;
  progress: number; // 0–1
  isMine: boolean;
}

function Waveform({ isPlaying, progress, isMine }: WaveformProps) {
  // Animate bars when playing — subtle pulse on active ones
  const pulseAnims = useRef(
    WAVEFORM_HEIGHTS.map(() => new Animated.Value(1)),
  ).current;

  useEffect(() => {
    if (!isPlaying) {
      pulseAnims.forEach((a) => a.setValue(1));
      return;
    }
    const animations = pulseAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1.3,
            duration: 400 + i * 30,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.8,
            duration: 400 + i * 30,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
  }, [isPlaying, pulseAnims]);

  const activeColor = isMine ? 'rgba(255,255,255,0.95)' : '#1B5E3B';
  const inactiveColor = isMine ? 'rgba(255,255,255,0.35)' : 'rgba(27,94,59,0.3)';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 28,
        flex: 1,
        marginHorizontal: 8,
      }}
    >
      {WAVEFORM_HEIGHTS.map((h, i) => {
        const fraction = i / WAVEFORM_HEIGHTS.length;
        const isPast = fraction <= progress;
        return (
          <Animated.View
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              backgroundColor: isPast ? activeColor : inactiveColor,
              transform: [{ scaleY: isPlaying && isPast ? pulseAnims[i] : 1 }],
            }}
          />
        );
      })}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface VoiceMessageBubbleProps {
  voiceNoteUrl: string;
  durationSecs: number | null; // from server metadata
  isMine: boolean;
  timestamp: string;
}

export function VoiceMessageBubble({
  voiceNoteUrl,
  durationSecs,
  isMine,
  timestamp,
}: VoiceMessageBubbleProps) {
  const { isPlaying, isLoading, positionMs, durationMs, error, play, pause } =
    useAudioPlayer(voiceNoteUrl);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Prefer server-provided duration for immediate render before audio loads
  const totalMs = durationMs ?? (durationSecs != null ? durationSecs * 1000 : null);
  const progress = totalMs && totalMs > 0 ? Math.min(positionMs / totalMs, 1) : 0;

  const displayDuration = isPlaying || positionMs > 0
    ? formatDuration(positionMs)
    : totalMs != null
    ? formatDuration(totalMs)
    : '0:00';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 20,
        borderBottomRightRadius: isMine ? 4 : 20,
        borderBottomLeftRadius: isMine ? 20 : 4,
        backgroundColor: isMine ? '#1B5E3B' : '#F3F4F6',
        minWidth: 180,
        maxWidth: '85%',
      }}
    >
      {/* Play/Pause button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={isLoading}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(27,94,59,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isMine ? '#fff' : '#1B5E3B'}
          />
        ) : isPlaying ? (
          <Pause size={16} color={isMine ? '#fff' : '#1B5E3B'} />
        ) : (
          <Play size={16} color={isMine ? '#fff' : '#1B5E3B'} />
        )}
      </TouchableOpacity>

      {/* Waveform */}
      <Waveform isPlaying={isPlaying} progress={progress} isMine={isMine} />

      {/* Duration + timestamp */}
      <View style={{ alignItems: 'flex-end', minWidth: 36 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: isMine ? '#fff' : '#1B5E3B',
            letterSpacing: 0.3,
          }}
        >
          {displayDuration}
        </Text>
        <Text
          style={{
            fontSize: 9,
            marginTop: 2,
            color: isMine ? 'rgba(255,255,255,0.6)' : '#9CA3AF',
          }}
        >
          {timestamp}
        </Text>
      </View>

      {/* Error state (subtle) */}
      {error && (
        <Text
          style={{
            position: 'absolute',
            bottom: -16,
            fontSize: 9,
            color: '#EF4444',
            alignSelf: 'center',
          }}
          numberOfLines={1}
        >
          ⚠ Failed to load audio
        </Text>
      )}
    </View>
  );
}
