/**
 * Website photo storage in the R2 bucket `brake-wedding`, through the Worker's
 * MEDIA binding (cloudflare.config.ts). No access keys exist or are needed: only
 * code running inside the Worker can read or write the bucket, and the bucket
 * itself is not public. Photos reach browsers through /media/[...key].
 *
 * Every key is built here (never taken from a client) and lives under site/.
 */
import "server-only";
import { env } from "cloudflare:workers";

const KEY_PATTERN = /^site\/(photos\/[0-9a-f-]{36}\/(master|full-\d{2,4})|crops\/[a-z0-9._/-]+-\d{2,4})\.(webp|jpg)$/;

export function isPublicMediaKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes("..");
}

export const CONTENT_TYPES = { webp: "image/webp", jpg: "image/jpeg" } as const;

function bucket(): R2BucketLike {
  const media = (env as { MEDIA?: R2BucketLike }).MEDIA;
  if (!media) throw new Error("R2 binding MEDIA is not configured (see cloudflare.config.ts).");
  return media;
}

export async function putMedia(key: string, body: ArrayBuffer, format: keyof typeof CONTENT_TYPES): Promise<void> {
  if (!isPublicMediaKey(key)) throw new Error(`Refusing to write unexpected media key: ${key}`);
  await bucket().put(key, body, {
    httpMetadata: { contentType: CONTENT_TYPES[format], cacheControl: "public, max-age=31536000, immutable" },
  });
}

export async function getMedia(key: string) {
  if (!isPublicMediaKey(key)) return null;
  return bucket().get(key);
}

/** Best-effort cleanup of replaced files. */
export async function deleteMedia(keys: string[]): Promise<void> {
  const safe = keys.filter(isPublicMediaKey);
  if (safe.length === 0) return;
  try {
    await bucket().delete(safe);
  } catch (error) {
    console.error("Deleting old media failed:", error);
  }
}
