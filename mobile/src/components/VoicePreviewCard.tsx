// File: mobile/src/components/VoicePreviewCard.tsx
/**
 * Sprint 7 — Voice Messages: Preview card shown after recording stops.
 *
 * Appears above the input bar. Shows:
 *   - Play/Pause to preview the recording
 *   - Waveform bars + duration
 *   - Trash (discard) and Send buttons
 *   - Upload progress indicator while sending
 *
 * Sends via:
 *   1. uploadVoiceNote() → get public URL
 *   2. api.post /messages/{bookingId} with { voice_note_url, content: "" }
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Trash2, Send, Play, Pause } from 'lucide-react-native';

import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { uploadVoiceNote } from '../services/voiceUpload';
import api from '../services/api';

// ── Mini waveform for preview card ───────────────────────────────────────

const BARS = [8, 14, 20, 16, 24, 18, 12, 20, 16, 10, 14, 22, 18, 12, 8];

function PreviewWaveform({ progress }: { progress: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 28,
        flex: 1,
        marginHorizontal: 8,
      }}
    >
      {BARS.map((h, i) => {
        const fraction = i / BARS.length;
        const isPast = fraction <= progress;
        return (
          <View
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              backgroundColor: isPast ? '#1B5E3B' : 'rgba(27,94,59,0.2)',
            }}
          />
        );
      })}
    </View>
  );
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Main component ────────────────────────────────────────────────────────

interface VoicePreviewCardProps {
  uri: string;
  durationSecs: number;
  bookingId: string;
  onDiscard: () => void;
  onSent: () => void;
}

export function VoicePreviewCard({
  uri,
  durationSecs,
  bookingId,
  onDiscard,
  onSent,
}: VoicePreviewCardProps) {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const { isPlaying, isLoading, positionMs, durationMs, play, pause } =
    useAudioPlayer(uri);

  const totalMs = durationMs ?? durationSecs * 1000;
  const progress = totalMs > 0 ? Math.min(positionMs / totalMs, 1) : 0;

  const handleSend = useCallback(async () => {
    setIsSending(true);
    setSendError(null);
    try {
      const { publicUrl } = await uploadVoiceNote(uri);
      await api.post(`/messages/${bookingId}`, {
        content: '',
        voice_note_url: publicUrl,
        voice_note_duration_secs: durationSecs,
      });
      onSent();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Upload failed';
      setSendError(msg);
      Alert.alert('Failed to send voice message', msg);
    } finally {
      setIsSending(false);
    }
  }, [uri, bookingId, durationSecs, onSent]);

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 12,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Play/Pause */}
        <TouchableOpacity
          onPress={() => (isPlaying ? pause() : play())}
          disabled={isLoading}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#1B5E3B',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isPlaying ? (
            <Pause size={16} color="#fff" />
          ) : (
            <Play size={16} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Waveform */}
        <PreviewWaveform progress={progress} />

        {/* Duration */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: '#1B5E3B',
            minWidth: 36,
          }}
        >
          {positionMs > 0 ? formatDuration(positionMs) : formatDuration(totalMs)}
        </Text>
      </View>

      {/* Error */}
      {sendError && (
        <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 6 }}>
          ⚠ {sendError}
        </Text>
      )}

      {/* Action buttons */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 12,
        }}
      >
        {/* Discard */}
        <TouchableOpacity
          onPress={onDiscard}
          disabled={isSending}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: '#FEF2F2',
            borderWidth: 1,
            borderColor: '#FECACA',
          }}
        >
          <Trash2 size={14} color="#EF4444" />
          <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>
            Delete
          </Text>
        </TouchableOpacity>

        {/* Send */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={isSending}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 18,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: '#1B5E3B',
            opacity: isSending ? 0.7 : 1,
          }}
        >
          {isSending ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                Sending…
              </Text>
            </>
          ) : (
            <>
              <Send size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                Send
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
