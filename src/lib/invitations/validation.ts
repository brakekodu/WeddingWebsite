/**
 * QR validation: proves, for one invitation, that
 *   1. a QR code is generated for the canonical URL,
 *   2. it decodes successfully,
 *   3. the decoded URL uses the configured canonical base URL,
 *   4. the decoded token equals the invitation's token,
 *   5. the token resolves to this invitation, and
 *   6. the public resolver returns exactly the expected guests.
 *
 * Lookups are injected so the core logic is unit-testable; the server action
 * supplies real database lookups (5 via admin query, 6 via the same public
 * RPC a guest's phone would hit).
 */
import { buildInvitationUrl, isProvisionalBaseUrl, parseInvitationUrl } from "@/lib/invitations/url";
import { createQrMatrix, decodeQr, qrMatrixToRgba } from "@/lib/invitations/qr";

export type QrCheckId =
  | "qr_generated"
  | "qr_decodes"
  | "canonical_base_url"
  | "token_matches"
  | "token_resolves_to_invitation"
  | "resolves_to_expected_guests";

export interface QrCheck {
  id: QrCheckId;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface QrValidationResult {
  status: "passed" | "failed";
  checkedAt: string;
  expectedUrl: string;
  decodedUrl: string | null;
  /** True when the base URL is localhost/preview/http and must not be used for final printing. */
  provisionalBaseUrl: boolean;
  checks: QrCheck[];
}

export interface QrValidationInput {
  invitation: { id: string; token: string; guestIds: string[] };
  baseUrl: string;
  /** Admin-side lookup: which invitation id owns this token (null if none). */
  findInvitationIdByToken: (token: string) => Promise<string | null>;
  /** Public resolution: guest ids returned by get_invitation(token) (null if it does not resolve). */
  resolvePublicGuestIds: (token: string) => Promise<string[] | null>;
  now?: () => Date;
}

const LABELS: Record<QrCheckId, string> = {
  qr_generated: "QR code exists",
  qr_decodes: "QR code decodes",
  canonical_base_url: "URL uses the canonical base URL",
  token_matches: "Decoded token matches the invitation",
  token_resolves_to_invitation: "Token resolves to this invitation",
  resolves_to_expected_guests: "Invitation resolves to the expected guests",
};

export async function validateInvitationQr(input: QrValidationInput): Promise<QrValidationResult> {
  const { invitation, baseUrl } = input;
  const checks: QrCheck[] = [];
  const add = (id: QrCheckId, passed: boolean, detail?: string) =>
    checks.push({ id, label: LABELS[id], passed, ...(detail ? { detail } : {}) });

  const expectedUrl = buildInvitationUrl(baseUrl, invitation.token);
  let decodedUrl: string | null = null;

  const finish = (): QrValidationResult => ({
    status: checks.length === Object.keys(LABELS).length && checks.every((c) => c.passed) ? "passed" : "failed",
    checkedAt: (input.now?.() ?? new Date()).toISOString(),
    expectedUrl,
    decodedUrl,
    provisionalBaseUrl: isProvisionalBaseUrl(baseUrl),
    checks,
  });

  let matrix;
  try {
    matrix = createQrMatrix(expectedUrl);
    add("qr_generated", true, `Version ${matrix.version}, ${matrix.size}×${matrix.size} modules`);
  } catch (error) {
    add("qr_generated", false, (error as Error).message);
    return finish();
  }

  decodedUrl = decodeQr(qrMatrixToRgba(matrix));
  add("qr_decodes", decodedUrl !== null, decodedUrl ?? "Decoder found no QR code");
  if (decodedUrl === null) return finish();

  const parsed = parseInvitationUrl(decodedUrl, baseUrl);
  add(
    "canonical_base_url",
    parsed !== null && decodedUrl === expectedUrl,
    parsed ? undefined : `Decoded URL is not ${new URL(baseUrl).origin}/i/{token}`,
  );
  if (!parsed) return finish();

  add("token_matches", parsed.token === invitation.token);
  if (parsed.token !== invitation.token) return finish();

  const ownerId = await input.findInvitationIdByToken(parsed.token);
  add(
    "token_resolves_to_invitation",
    ownerId === invitation.id,
    ownerId === null
      ? "Token not found"
      : ownerId === invitation.id
        ? undefined
        : "Token belongs to a different invitation",
  );

  const publicGuestIds = await input.resolvePublicGuestIds(parsed.token);
  const expected = [...invitation.guestIds].sort();
  const actual = publicGuestIds ? [...publicGuestIds].sort() : null;
  const guestsMatch =
    actual !== null &&
    expected.length > 0 &&
    actual.length === expected.length &&
    actual.every((id, i) => id === expected[i]);
  add(
    "resolves_to_expected_guests",
    guestsMatch,
    actual === null
      ? "Public link does not resolve (is the invitation void?)"
      : expected.length === 0
        ? "Invitation has no guests"
        : guestsMatch
          ? `${actual.length} guest(s)`
          : `Expected ${expected.length} guest(s), public link returned ${actual.length}`,
  );

  return finish();
}

/** Validation is stale if it was performed for a different URL than the current canonical one. */
export function effectiveValidationStatus(
  invitation: { qr_validation_status: string; validated_url: string | null; token: string },
  baseUrl: string,
): "passed" | "failed" | "not_validated" | "stale" {
  const status = invitation.qr_validation_status;
  if (status === "not_validated") return "not_validated";
  if (invitation.validated_url !== buildInvitationUrl(baseUrl, invitation.token)) return "stale";
  return status === "passed" ? "passed" : "failed";
}
