// File: mobile/src/hooks/useAudioPlayer.ts
/**
 * Sprint 7 — Voice Messages: Audio playback hook using expo-av.
 *
 * Controls a single Audio.Sound instance per invocation.
 * Automatically unloads on unmount or when uri changes.
 *
 * Autoplay: OFF by default — respects data costs for Rwanda users.
 *
 * Public API:
 *   play()       — load (if needed) and play from current position
 *   pause()      — pause playback
 *   seek(ms)     — seek to position in milliseconds
 *   isPlaying    — boolean
 *   isLoading    — loading audio from network
 *   positionMs   — current playback position in ms
 *   durationMs   — total duration in ms (null until loaded)
 *   error        — last error string or null
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  positionMs: number;
  durationMs: number | null;
  error: string | null;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
}

export function useAudioPlayer(uri: string | null): AudioPlayerState {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const _onPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) setError(status.error);
      return;
    }
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis ?? 0);
    if (status.durationMillis != null) {
      setDurationMs(status.durationMillis);
    }
    // Auto-reset to start when finished
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
    }
  }, []);

  // Unload on uri change or unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [uri]);

  const _ensureLoaded = useCallback(async (): Promise<Audio.Sound | null> => {
    if (!uri) return null;

    if (soundRef.current) return soundRef.current;

    setIsLoading(true);
    setError(null);

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 200 },
        _onPlaybackStatus,
      );
      soundRef.current = sound;
      return sound;
    } catch (err: any) {
      setError(`Could not load audio: ${err?.message ?? 'Unknown error'}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [uri, _onPlaybackStatus]);

  const play = useCallback(async () => {
    const sound = await _ensureLoaded();
    if (!sound) return;
    try {
      await sound.playAsync();
    } catch (err: any) {
      setError(`Playback error: ${err?.message}`);
    }
  }, [_ensureLoaded]);

  const pause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync();
    } catch {
      // Ignore
    }
  }, []);

  const seek = useCallback(async (ms: number) => {
    const sound = await _ensureLoaded();
    if (!sound) return;
    try {
      await sound.setPositionAsync(ms);
    } catch {
      // Ignore seek errors
    }
  }, [_ensureLoaded]);

  return { isPlaying, isLoading, positionMs, durationMs, error, play, pause, seek };
}
