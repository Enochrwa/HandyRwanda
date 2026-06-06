// File: mobile/src/services/imageUpload.ts
/**
 * Mobile image upload utilities using presigned URLs.
 *
 * Uses expo-image-manipulator for compression before upload.
 * Uploads directly from device to Supabase Storage (PUT to presigned URL),
 * bypassing the API server — critical for 3G/4G reliability in Rwanda.
 *
 * File size gate: rejects images > 5 MB before any network call.
 */
import * as FileSystem from 'expo-file-system';

import api from './api';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const COMPRESS_QUALITY = 0.8;
const MAX_DIMENSION = 1280;

export type UploadType =
  | 'avatar'
  | 'portfolio'
  | 'job_photo'
  | 'id_document'
  | 'selfie'
  | 'payment_proof'
  | 'dispute_evidence'
  | 'before_photo'
  | 'after_photo';

export interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Compress an image using expo-image-manipulator.
 * Resizes to at most MAX_DIMENSION on the longest side, compresses to COMPRESS_QUALITY.
 * Returns the local URI of the compressed image.
 */
async function compressImage(uri: string): Promise<string> {
  try {
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const result = await manipulateAsync(uri, [{ resize: { width: MAX_DIMENSION } }], {
      compress: COMPRESS_QUALITY,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch {
    // Compression unavailable — return original
    return uri;
  }
}

/**
 * Upload an image from a local URI using the presigned URL flow.
 *
 * @param uri        - Local file URI (from expo-image-picker or camera)
 * @param uploadType - Bucket/folder context
 * @param compress   - Whether to compress first (default: true)
 */
export async function uploadImage(
  uri: string,
  uploadType: UploadType,
  compress = true,
  filename?: string,
): Promise<UploadResult> {
  // 1. Validate file size
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (info.exists && 'size' in info && info.size && info.size > MAX_BYTES) {
    throw new Error(`Image too large (${(info.size / 1024 / 1024).toFixed(1)} MB). Maximum 5 MB.`);
  }

  // 2. Compress (skip for documents)
  const skipCompress = ['id_document', 'payment_proof'].includes(uploadType);
  let uploadUri = uri;
  if (compress && !skipCompress) {
    uploadUri = await compressImage(uri);
  }

  // 3. Get presigned URL from backend
  const { data: presign } = await api.post('/uploads/presign', {
    upload_type: uploadType,
    content_type: 'image/jpeg',
    filename: filename ?? `upload_${Date.now()}.jpg`,
  });

  // 4. Upload directly to Supabase using FileSystem.uploadAsync (multipart or PUT)
  const uploadResult = await FileSystem.uploadAsync(presign.upload_url, uploadUri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Upload failed with HTTP ${uploadResult.status}`);
  }

  return { publicUrl: presign.public_url, path: presign.path };
}
