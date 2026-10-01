/**
 * Cloudflare R2 foundation (not used in Phase 1).
 *
 * R2 speaks the S3 API. The browser never receives R2 credentials: the server
 * authorizes a specific action and returns a short-lived presigned URL scoped
 * to one object key. The bucket stays private; public assets will be served
 * later through a custom domain or an explicit read path, never by making the
 * whole bucket public. See docs/ARCHITECTURE.md and docs/SECURITY.md.
 */
import "server-only";
import { AwsClient } from "aws4fetch";

/** Logical top-level prefixes inside the single `brake-wedding` bucket. */
export const R2_PREFIXES = {
  site: "site/",
  engagement: "engagement/",
  wedding: "wedding/",
  guestUploads: "guest-uploads/",
  gallery: "gallery/",
} as const;

export type R2Prefix = keyof typeof R2_PREFIXES;

/** Presigned URLs are deliberately short-lived. */
export const MAX_PRESIGN_SECONDS = 15 * 60;

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Returns null until R2 credentials are configured (they are not needed yet). */
export function getR2Config(env: Record<string, string | undefined> = process.env): R2Config | null {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    bucket: R2_BUCKET,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  };
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Builds an object key under a known prefix. Segments are restricted to a safe
 * character set, so callers cannot traverse into another prefix.
 */
export function buildObjectKey(prefix: R2Prefix, ...segments: string[]): string {
  if (segments.length === 0) throw new Error("At least one key segment is required.");
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment.includes("..")) {
      throw new Error(`Unsafe object key segment: "${segment}"`);
    }
  }
  return R2_PREFIXES[prefix] + segments.join("/");
}

function objectUrl(config: R2Config, key: string): URL {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodedKey}`);
}

async function presign(
  config: R2Config,
  method: "GET" | "PUT",
  key: string,
  expiresInSeconds: number,
  headers: Record<string, string> = {},
): Promise<string> {
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > MAX_PRESIGN_SECONDS) {
    throw new Error(`Presigned URL lifetime must be 1–${MAX_PRESIGN_SECONDS} seconds.`);
  }
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const url = objectUrl(config, key);
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signed = await client.sign(new Request(url, { method, headers }), {
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

/** A URL that lets the holder PUT exactly one object of the given content type. */
export function createPresignedUploadUrl(
  config: R2Config,
  key: string,
  options: { contentType: string; expiresInSeconds?: number },
): Promise<string> {
  return presign(config, "PUT", key, options.expiresInSeconds ?? 5 * 60, {
    "content-type": options.contentType,
  });
}

export function createPresignedDownloadUrl(
  config: R2Config,
  key: string,
  options: { expiresInSeconds?: number } = {},
): Promise<string> {
  return presign(config, "GET", key, options.expiresInSeconds ?? 5 * 60);
}
