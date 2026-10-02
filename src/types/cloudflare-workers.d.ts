/**
 * Minimal types for the Cloudflare Workers runtime module used by
 * src/lib/media/storage.ts. (The full generated runtime types redefine DOM
 * globals, so we declare only what we use.)
 */
interface R2ObjectBodyLike {
  body: ReadableStream;
  httpEtag: string;
  size: number;
  httpMetadata?: { contentType?: string; cacheControl?: string };
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
