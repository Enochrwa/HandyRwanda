// File: mobile/src/services/voiceUpload.ts
/**
 * Voice note upload utilities using presigned URLs.
 *
 * Sprint 7 — Voice Messages in Chat.
 *
 * Flow (mirrors imageUpload.ts pattern):
 *   1. Get presigned URL from backend (POST /uploads/presign)
 *   2. Upload audio file directly to Supabase via PUT (no API server in the loop)
 *   3. Return { publicUrl, path }
 *
 * Audio specs (Expo AV defaults):
 *   - iOS  → .m4a  (audio/m4a)
 *   - Android → .mp4 (audio/mp4 / audio/m4a depending on device)
 *
 * Max: 10 MB (enforced by backend; we gate at 9.5 MB client-side for UX).
 */

import * as FileSystem from 'expo-file-system';

import api from './api';

const MAX_BYTES = 9.5 * 1024 * 1024; // 9.5 MB — leave 0.5 MB headroom

export interface VoiceUploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Detect the MIME type from a URI path.
 * Expo AV produces .m4a on iOS and .mp4 on Android.
 */
function mimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.m4a')) return 'audio/m4a';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  // Android fallback — .mp4 container with audio codec
  return 'audio/mp4';
}

/**
 * Upload a voice note from a local URI using the presigned URL flow.
 *
 * @param uri       - Local file URI produced by expo-av Audio.Recording
 * @param filename  - Optional filename override
 */
export async function uploadVoiceNote(
  uri: string,
  filename?: string,
): Promise<VoiceUploadResult> {
  // 1. Validate file size before any network call
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (info.exists && 'size' in info && info.size && info.size > MAX_BYTES) {
    const mb = (info.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `Voice note too large (${mb} MB). Please keep recordings under 9.5 MB.`,
    );
  }

  const contentType = mimeFromUri(uri);
  const safeFilename =
    filename ?? `voice_${Date.now()}.${contentType.split('/')[1]}`;

  // 2. Get presigned URL
  const { data: presign } = await api.post('/uploads/presign', {
    upload_type: 'voice_note',
    content_type: contentType,
    filename: safeFilename,
  });

  // 3. Upload directly to Supabase Storage via PUT
  const uploadResult = await FileSystem.uploadAsync(presign.upload_url, uri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Voice upload failed — HTTP ${uploadResult.status}`);
  }

  return {
    publicUrl: presign.public_url,
    path: presign.path,
  };
}
