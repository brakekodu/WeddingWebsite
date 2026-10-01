import { describe, expect, it } from "vitest";
import { buildObjectKey, createPresignedUploadUrl, getR2Config, MAX_PRESIGN_SECONDS } from "./r2";

// Dummy values: presigning is a local HMAC computation, no network involved.
const config = {
  accountId: "0123456789abcdef0123456789abcdef",
  bucket: "brake-wedding",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
};

describe("R2 foundation", () => {
  it("is unconfigured until all credentials exist", () => {
    expect(getR2Config({ R2_BUCKET: "brake-wedding" })).toBeNull();
  });

  it("builds keys under the planned prefixes and rejects traversal", () => {
    expect(buildObjectKey("guestUploads", "abc123", "photo.jpg")).toBe("guest-uploads/abc123/photo.jpg");
    expect(buildObjectKey("site", "hero.webp")).toBe("site/hero.webp");
    expect(() => buildObjectKey("gallery", "..", "x")).toThrow(/Unsafe/);
    expect(() => buildObjectKey("gallery", "a/b")).toThrow(/Unsafe/);
    expect(() => buildObjectKey("gallery")).toThrow();
  });

  it("creates short-lived, single-object presigned upload URLs", async () => {
    const url = new URL(
      await createPresignedUploadUrl(config, "guest-uploads/abc/photo.jpg", { contentType: "image/jpeg" }),
    );
    expect(url.host).toBe(`${config.accountId}.r2.cloudflarestorage.com`);
    expect(url.pathname).toBe("/brake-wedding/guest-uploads/abc/photo.jpg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(url.toString()).not.toContain(config.secretAccessKey);
  });

  it("caps presigned URL lifetime", async () => {
    await expect(
      createPresignedUploadUrl(config, "site/x", {
        contentType: "image/png",
        expiresInSeconds: MAX_PRESIGN_SECONDS + 1,
      }),
    ).rejects.toThrow(/lifetime/);
  });
});
