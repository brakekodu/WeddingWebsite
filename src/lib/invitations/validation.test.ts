import { describe, expect, it } from "vitest";
import { buildInvitationUrl } from "./url";
import { effectiveValidationStatus, validateInvitationQr, type QrValidationInput } from "./validation";

const TOKEN = "Ab3_-Zx9Ab3_-Zx9Ab3_-Zx9";
const BASE = "https://example.com";

function input(overrides: Partial<QrValidationInput> = {}): QrValidationInput {
  return {
    invitation: { id: "inv-1", token: TOKEN, guestIds: ["john", "sarah"] },
    baseUrl: BASE,
    findInvitationIdByToken: async (token) => (token === TOKEN ? "inv-1" : null),
    resolvePublicGuestIds: async () => ["sarah", "john"],
    now: () => new Date("2026-10-01T12:00:00Z"),
    ...overrides,
  };
}

describe("validateInvitationQr", () => {
  it("passes every check for a healthy invitation", async () => {
    const result = await validateInvitationQr(input());
    expect(result.status).toBe("passed");
    expect(result.decodedUrl).toBe(`${BASE}/i/${TOKEN}`);
    expect(result.expectedUrl).toBe(result.decodedUrl);
    expect(result.provisionalBaseUrl).toBe(false);
    expect(result.checks.map((c) => [c.id, c.passed])).toEqual([
      ["qr_generated", true],
      ["qr_decodes", true],
      ["canonical_base_url", true],
      ["token_matches", true],
      ["token_resolves_to_invitation", true],
      ["resolves_to_expected_guests", true],
    ]);
  });

  it("fails when the token belongs to another invitation", async () => {
    const result = await validateInvitationQr(input({ findInvitationIdByToken: async () => "inv-2" }));
    expect(result.status).toBe("failed");
    expect(result.checks.find((c) => c.id === "token_resolves_to_invitation")?.passed).toBe(false);
  });

  it("fails when the public link does not resolve (e.g. void)", async () => {
    const result = await validateInvitationQr(input({ resolvePublicGuestIds: async () => null }));
    expect(result.status).toBe("failed");
    expect(result.checks.at(-1)?.detail).toMatch(/does not resolve/);
  });

  it("fails when guests differ or the invitation has none", async () => {
    const mismatch = await validateInvitationQr(input({ resolvePublicGuestIds: async () => ["john"] }));
    expect(mismatch.status).toBe("failed");

    const empty = await validateInvitationQr(
      input({
        invitation: { id: "inv-1", token: TOKEN, guestIds: [] },
        resolvePublicGuestIds: async () => [],
      }),
    );
    expect(empty.status).toBe("failed");
    expect(empty.checks.at(-1)?.detail).toMatch(/no guests/);
  });

  it("reports provisional base URLs", async () => {
    const result = await validateInvitationQr(input({ baseUrl: "http://localhost:3000" }));
    expect(result.status).toBe("passed");
    expect(result.provisionalBaseUrl).toBe(true);
  });
});

describe("effectiveValidationStatus", () => {
  const url = buildInvitationUrl(BASE, TOKEN);

  it("is stale when validated for a different base URL", () => {
    const inv = { qr_validation_status: "passed", validated_url: url, token: TOKEN };
    expect(effectiveValidationStatus(inv, BASE)).toBe("passed");
    expect(effectiveValidationStatus(inv, "https://new-domain.com")).toBe("stale");
  });

  it("passes through failed and not_validated", () => {
    expect(effectiveValidationStatus({ qr_validation_status: "failed", validated_url: url, token: TOKEN }, BASE)).toBe(
      "failed",
    );
    expect(
      effectiveValidationStatus({ qr_validation_status: "not_validated", validated_url: null, token: TOKEN }, BASE),
    ).toBe("not_validated");
  });
});
