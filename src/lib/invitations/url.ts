/**
 * Invitation URL helpers.
 *
 * The canonical invitation URL is always derived as APP_BASE_URL + /i/{token}.
 * Nothing about the base URL is stored with the invitation, so changing the
 * production domain never requires regenerating tokens.
 */
import { isInvitationToken } from "@/lib/invitations/credentials";

export const INVITATION_PATH_PREFIX = "/i/";

/** Validates and canonicalizes a base URL to a bare origin (no path, query, or trailing slash). */
export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`APP_BASE_URL must be an absolute URL, got "${raw}".`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`APP_BASE_URL must use http or https, got "${url.protocol}".`);
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    throw new Error(`APP_BASE_URL must be an origin only (no path, query, or hash), got "${raw}".`);
  }
  if (url.username || url.password) {
    throw new Error("APP_BASE_URL must not contain credentials.");
  }
  return url.origin;
}

export function buildInvitationUrl(baseUrl: string, token: string): string {
  if (!isInvitationToken(token)) throw new Error("Invalid invitation token format.");
  return `${normalizeBaseUrl(baseUrl)}${INVITATION_PATH_PREFIX}${token}`;
}

export function buildRsvpCodeUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/rsvp`;
}

/** Extracts the token from a URL if (and only if) it is a canonical invitation URL for baseUrl. */
export function parseInvitationUrl(candidate: string, baseUrl: string): { token: string } | null {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.origin !== normalizeBaseUrl(baseUrl)) return null;
  if (url.search || url.hash) return null;
  if (!url.pathname.startsWith(INVITATION_PATH_PREFIX)) return null;
  const token = url.pathname.slice(INVITATION_PATH_PREFIX.length);
  return isInvitationToken(token) ? { token } : null;
}

const PROVISIONAL_HOST_SUFFIXES = [".vercel.app", ".pages.dev", ".workers.dev", ".ngrok.io", ".ngrok-free.app"];

/**
 * True when the base URL is clearly not the final production domain
 * (localhost, LAN/IP addresses, preview hosts, or plain http). Invitations
 * must not be printed for real while this is true.
 */
export function isProvisionalBaseUrl(baseUrl: string): boolean {
  const url = new URL(normalizeBaseUrl(baseUrl));
  const host = url.hostname;
  if (url.protocol !== "https:") return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return true;
  return PROVISIONAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
