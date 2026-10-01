/**
 * Invitation credential formats. Generation happens only in the database
 * (see supabase/migrations/*_invitations.sql); these helpers validate and
 * format values for display and lookup.
 */

/** 24 characters of base64url (144 random bits). */
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

/** Unambiguous alphabet: no 0/O, 1/I/L. */
export const RSVP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RSVP_CODE_LENGTH = 8;
const RSVP_CODE_PATTERN = new RegExp(`^[${RSVP_CODE_ALPHABET}]{${RSVP_CODE_LENGTH}}$`);

export function isInvitationToken(value: unknown): value is string {
  return typeof value === "string" && INVITATION_TOKEN_PATTERN.test(value);
}

/** Uppercases and strips spaces/dashes, as guests may type "abcd-2345". */
export function normalizeRsvpCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isRsvpCode(value: string): boolean {
  return RSVP_CODE_PATTERN.test(value);
}

/** "ABCD2345" -> "ABCD-2345" for printing. */
export function formatRsvpCode(code: string): string {
  const normalized = normalizeRsvpCode(code);
  return normalized.length === RSVP_CODE_LENGTH ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
}
