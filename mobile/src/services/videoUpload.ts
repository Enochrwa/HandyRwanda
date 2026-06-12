// File: mobile/src/services/videoUpload.ts
/**
 * Sprint 10 — Skill Video Upload Service
 *
 * Handles direct-to-Supabase upload of artisan skill verification videos.
 *
 * Flow (mirrors voiceUpload.ts pattern):
 *   1. Validate file size (max 50 MB, 60 s cap handled by picker)
 *   2. Detect MIME type from file extension
 *   3. POST /uploads/presign { upload_type: 'skill_video', content_type, filename }
 *   4. PUT video bytes directly to Supabase via FileSystem.uploadAsync
 *   5. Return { publicUrl, path }
 *
 * Supported formats:
 *   - .mp4  → video/mp4  (Android & iOS)
 *   - .mov  → video/quicktime (iOS camera default)
 *
 * Max: 50 MB (enforced by backend; we gate at 48 MB client-side for UX headroom).
 */

import * as FileSystem from 'expo-file-system';

import api from './api';

const MAX_BYTES = 48 * 1024 * 1024; // 48 MB — 2 MB UX headroom before backend 50 MB limit

export interface VideoUploadResult {
  publicUrl: string;
  path: string;
  sizeBytes: number;
  durationSeconds?: number;
}

/**
 * Determine the MIME type from a local video URI.
 * Falls back to video/mp4 which works on both iOS and Android.
 */
function mimeFromUri(uri: string): 'video/mp4' | 'video/quicktime' {
  const lower = uri.toLowerCase();
  if (lower.includes('.mov') || lower.includes('quicktime')) return 'video/quicktime';
  return 'video/mp4';
}

/**
 * Upload a skill verification video from a local URI using the presigned URL flow.
 *
 * @param uri              - Local file URI produced by expo-image-picker (video mode)
 * @param durationSeconds  - Video duration from picker metadata (used for API metadata)
 * @param filename         - Optional filename override
 *
 * @throws Error if file exceeds 48 MB size limit
 * @throws Error if Supabase PUT returns a non-2xx status
 */
export async function uploadSkillVideo(
  uri: string,
  durationSeconds?: number,
  filename?: string,
): Promise<VideoUploadResult> {
  // 1. Validate file size before any network call
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  const sizeBytes = info.exists && 'size' in info && info.size ? info.size : 0;

  if (sizeBytes > MAX_BYTES) {
    const mb = (sizeBytes / 1024 / 1024).toFixed(1);
    throw new Error(
      `Video too large (${mb} MB). Please trim it to under 48 MB (roughly 60 seconds at standard quality).`,
    );
  }

  const contentType = mimeFromUri(uri);
  const ext = contentType === 'video/quicktime' ? 'mov' : 'mp4';
  const safeFilename = filename ?? `skill_video_${Date.now()}.${ext}`;

  // 2. Get presigned URL from backend
  const { data: presign } = await api.post('/uploads/presign', {
    upload_type: 'skill_video',
    content_type: contentType,
    filename: safeFilename,
  });

  // 3. Upload directly to Supabase Storage — PUT with binary content
  const uploadResult = await FileSystem.uploadAsync(presign.upload_url, uri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Video upload to storage failed — HTTP ${uploadResult.status}`);
  }

  return {
    publicUrl: presign.public_url,
    path: presign.path,
    sizeBytes,
    durationSeconds,
  };
}
