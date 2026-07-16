/**
 * Market-image upload + URL helpers.
 *
 * Upload flow:
 *   1. Client POSTs /images/upload-url with {contentType, sizeBytes}
 *   2. Server returns {uploadUrl, key, expiresInSec, maxBytes}
 *   3. Client PUTs the file bytes directly to uploadUrl (Railway S3-compat)
 *   4. Client passes `key` back when submitting the market draft
 */
import { api, BACKEND_URL } from "@/lib/api/client";

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  expiresInSec: number;
  maxBytes: number;
}

export async function presignMarketImageUpload(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<PresignedUploadResponse> {
  return api.post<PresignedUploadResponse>("/images/upload-url", input);
}

/**
 * Upload bytes directly to the presigned URL. Returns when the PUT
 * succeeds. Throws on any non-2xx so callers can show a toast.
 */
export async function putToPresignedUrl(args: {
  url: string;
  file: File;
}): Promise<void> {
  const res = await fetch(args.url, {
    method: "PUT",
    body: args.file,
    headers: { "Content-Type": args.file.type },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`upload failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

/**
 * Build the proxy URL the UI renders. Keys come back as
 * `market-images/<32-hex>.<ext>`; the proxy endpoint is
 * `/images/m/<32-hex>.<ext>`. Returns null when key is null/invalid.
 */
export function imageKeyToUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const m = key.match(/^market-images\/([a-f0-9]{32}\.(?:jpg|png|webp|gif))$/);
  if (!m) return null;
  return `${BACKEND_URL.replace(/\/$/, "")}/images/m/${m[1]}`;
}
