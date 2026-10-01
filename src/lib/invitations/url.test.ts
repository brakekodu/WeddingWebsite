import { describe, expect, it } from "vitest";
import { formatRsvpCode, isInvitationToken, normalizeRsvpCode } from "./credentials";
import { buildInvitationUrl, isProvisionalBaseUrl, normalizeBaseUrl, parseInvitationUrl } from "./url";

const TOKEN = "Ab3_-Zx9Ab3_-Zx9Ab3_-Zx9";

describe("normalizeBaseUrl", () => {
  it("reduces to a bare origin", () => {
    expect(normalizeBaseUrl("https://Example.com/")).toBe("https://example.com");
    expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects paths, queries, credentials, and non-http schemes", () => {
    expect(() => normalizeBaseUrl("https://example.com/wedding")).toThrow(/origin only/);
    expect(() => normalizeBaseUrl("https://example.com?x=1")).toThrow(/origin only/);
    expect(() => normalizeBaseUrl("https://u:p@example.com")).toThrow(/credentials/);
    expect(() => normalizeBaseUrl("ftp://example.com")).toThrow(/http or https/);
    expect(() => normalizeBaseUrl("example.com")).toThrow(/absolute URL/);
  });
});

describe("invitation URLs", () => {
  it("builds APP_BASE_URL + /i/{token}", () => {
    expect(buildInvitationUrl("https://example.com/", TOKEN)).toBe(`https://example.com/i/${TOKEN}`);
  });

  it("refuses to build a URL for a malformed token", () => {
    expect(() => buildInvitationUrl("https://example.com", "short")).toThrow();
  });

  it("parses only canonical URLs for the configured base", () => {
    expect(parseInvitationUrl(`https://example.com/i/${TOKEN}`, "https://example.com")).toEqual({
      token: TOKEN,
    });
    expect(parseInvitationUrl(`https://evil.com/i/${TOKEN}`, "https://example.com")).toBeNull();
    expect(parseInvitationUrl(`http://example.com/i/${TOKEN}`, "https://example.com")).toBeNull();
    expect(parseInvitationUrl(`https://example.com/i/${TOKEN}?x=1`, "https://example.com")).toBeNull();
    expect(parseInvitationUrl(`https://example.com/x/${TOKEN}`, "https://example.com")).toBeNull();
    expect(parseInvitationUrl(`https://example.com/i/${TOKEN}/`, "https://example.com")).toBeNull();
    expect(parseInvitationUrl("not a url", "https://example.com")).toBeNull();
  });

  it("flags non-production base URLs as provisional", () => {
    expect(isProvisionalBaseUrl("http://localhost:3000")).toBe(true);
    expect(isProvisionalBaseUrl("http://192.168.1.20:3000")).toBe(true);
    expect(isProvisionalBaseUrl("https://wedding-abc.vercel.app")).toBe(true);
    expect(isProvisionalBaseUrl("http://example.com")).toBe(true);
    expect(isProvisionalBaseUrl("https://example.com")).toBe(false);
  });
});

describe("credentials", () => {
  it("recognizes token format", () => {
    expect(isInvitationToken(TOKEN)).toBe(true);
    expect(isInvitationToken(TOKEN + "x")).toBe(false);
    expect(isInvitationToken("../../etc/passwd/aaaaaaaaa")).toBe(false);
    expect(isInvitationToken(undefined)).toBe(false);
  });

  it("normalizes and formats RSVP codes", () => {
    expect(normalizeRsvpCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(formatRsvpCode("ABCD2345")).toBe("ABCD-2345");
  });
});
