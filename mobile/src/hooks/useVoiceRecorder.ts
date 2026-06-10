// File: mobile/src/hooks/useVoiceRecorder.ts
/**
 * Sprint 7 — Voice Messages: Recording hook using expo-av.
 *
 * State machine:
 *   idle → recording → stopped (→ idle on discard/send)
 *
 * Public API:
 *   startRecording()    — requests permission + begins recording
 *   stopRecording()     — stops; sets recordingUri + durationSecs
 *   discardRecording()  — clears state, back to idle
 *   elapsedSecs         — live elapsed seconds while recording
 *   state               — 'idle' | 'recording' | 'stopped'
 *   recordingUri        — local file URI after stop
 *   durationSecs        — total duration after stop
 *   error               — last error message (null if none)
 *
 * Permission:
 *   Requests Audio recording permission on first startRecording() call.
 *   If denied, sets error and stays idle.
 *
 * Max duration: 5 minutes (300 s). Recording auto-stops at limit.
 * Audio quality: HIGH preset (best quality / reasonable size for Rwanda 4G).
 */

import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecorderState = 'idle' | 'recording' | 'stopped';

export interface VoiceRecorderResult {
  state: VoiceRecorderState;
  elapsedSecs: number;
  recordingUri: string | null;
  durationSecs: number | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  discardRecording: () => void;
}

const MAX_DURATION_SECS = 300; // 5 minutes hard cap

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,   // mono — halves file size, fine for voice
    bitRate: 64000,        // 64 kbps — ~28 MB/hr, very reasonable
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

export function useVoiceRecorder(): VoiceRecorderResult {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [durationSecs, setDurationSecs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const _clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    // ── Permission ──────────────────────────────────────────────────────────
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      setError('Microphone permission is required to send voice messages.');
      return;
    }

    // ── Audio mode ──────────────────────────────────────────────────────────
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    try {
      const { recording } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS,
        undefined,
        // Update status every 100ms for smooth elapsed counter
        100,
      );
      recordingRef.current = recording;

      startTimeRef.current = Date.now();
      setElapsedSecs(0);
      setState('recording');

      // ── Elapsed timer ───────────────────────────────────────────────────
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSecs(elapsed);

        // Auto-stop at 5 minutes
        if (elapsed >= MAX_DURATION_SECS) {
          stopRecording();
        }
      }, 1000);
    } catch (err: any) {
      setError(`Could not start recording: ${err?.message ?? 'Unknown error'}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(async () => {
    _clearTimer();

    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      const dur = status.isRecording ? 0 : (status as any).durationMillis ?? 0;

      recordingRef.current = null;

      if (!uri) {
        setError('Recording failed — no audio file produced.');
        setState('idle');
        return;
      }

      setRecordingUri(uri);
      setDurationSecs(Math.round(dur / 1000));
      setState('stopped');
    } catch (err: any) {
      setError(`Failed to stop recording: ${err?.message ?? 'Unknown error'}`);
      setState('idle');
    }

    // Reset audio mode
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }, [_clearTimer]);

  const discardRecording = useCallback(() => {
    _clearTimer();
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    setRecordingUri(null);
    setDurationSecs(null);
    setElapsedSecs(0);
    setError(null);
    setState('idle');
  }, [_clearTimer]);

  return {
    state,
    elapsedSecs,
    recordingUri,
    durationSecs,
    error,
    startRecording,
    stopRecording,
    discardRecording,
  };
}
