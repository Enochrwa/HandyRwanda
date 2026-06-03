// File: web/src/services/imageUpload.ts
/**
 * Client-side image upload utilities.
 *
 * Uses presigned URLs to upload directly from browser to Supabase Storage,
 * bypassing the API server entirely. Includes:
 *   - Client-side compression via canvas (reduces 3MB → ~300KB for portfolios)
 *   - File size validation gate (5 MB hard limit)
 *   - Progress callback support
 */
import api from "./api";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TARGET_DIMENSION = 1280; // px — max dimension after compression
const JPEG_QUALITY = 0.82;

export type UploadType =
  | "avatar"
  | "portfolio"
  | "job_photo"
  | "id_document"
  | "selfie"
  | "payment_proof"
  | "dispute_evidence"
  | "before_photo"
  | "after_photo";

export interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Compress an image file using canvas before upload.
 * Resizes to at most TARGET_DIMENSION on longest side, JPEG quality JPEG_QUALITY.
 * Returns a Blob ready for upload.
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > TARGET_DIMENSION || height > TARGET_DIMENSION) {
        const ratio = Math.min(TARGET_DIMENSION / width, TARGET_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D not available")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          resolve(blob);
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}

/**
 * Upload an image file using the presigned URL flow.
 *
 * @param file       - The File object from an <input type="file">
 * @param uploadType - The bucket/folder context
 * @param compress   - Whether to compress before upload (default: true)
 * @param onProgress - Optional progress callback (0–100)
 */
export async function uploadImage(
  file: File,
  uploadType: UploadType,
  compress = true,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  // 1. Validate file size before compression
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 5 MB.`);
  }

  // 2. Compress (skip for documents)
  const skipCompress = ["id_document", "payment_proof", "dispute_evidence"].includes(uploadType);
  let uploadBlob: Blob = file;
  if (compress && !skipCompress) {
    uploadBlob = await compressImage(file);
  }

  // 3. Get presigned URL from backend
  const { data: presign } = await api.post("/uploads/presign", {
    upload_type: uploadType,
    content_type: "image/jpeg",
    filename: file.name,
  });

  // 4. Upload directly to Supabase Storage
  await uploadDirectly(presign.upload_url, uploadBlob, onProgress);

  return { publicUrl: presign.public_url, path: presign.path };
}

async function uploadDirectly(
  uploadUrl: string,
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", "image/jpeg");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(blob);
  });
}
