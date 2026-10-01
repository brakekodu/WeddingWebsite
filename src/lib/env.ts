/**
 * Environment access. Values are read lazily so `next build` works without
 * secrets, and each accessor fails with a message naming the missing variable.
 *
 * Browser-safe values use the NEXT_PUBLIC_ prefix and are inlined into the
 * client bundle at build time. Everything else is server-only, and this
 * module refuses to be bundled for the browser.
 */
import "server-only";
import { normalizeBaseUrl } from "@/lib/invitations/url";

export class MissingEnvError extends Error {
  constructor(name: string, hint: string) {
    super(`Missing environment variable ${name}. ${hint} See .env.example and docs/DEPLOYMENT.md.`);
    this.name = "MissingEnvError";
  }
}

/** Unset, empty, or still a "REPLACE_WITH_…" placeholder from cloudflare.config.ts. */
export function isUnset(value: string | undefined): value is undefined {
  return !value || value.trim() === "" || value.includes("REPLACE_WITH");
}

function required(name: string, value: string | undefined, hint: string): string {
  if (isUnset(value)) throw new MissingEnvError(name, hint);
  return value.trim();
}

/** Browser-safe Supabase settings (publishable key is designed to be public; RLS protects data). */
export function getSupabasePublicEnv(): { url: string; publishableKey: string } {
  return {
    url: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "Set it to the Supabase project URL.",
    ),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "Set it to the project's publishable (anon) key.",
    ),
  };
}

export function isSupabaseConfigured(): boolean {
  return !isUnset(process.env.NEXT_PUBLIC_SUPABASE_URL) && !isUnset(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Canonical origin for invitation links and QR codes, e.g. https://example.com.
 * Server-only so the canonical URL is never taken from request headers.
 */
export function getAppBaseUrl(): string {
  return normalizeBaseUrl(required("APP_BASE_URL", process.env.APP_BASE_URL, "Set it to the site origin."));
}
