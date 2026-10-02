import { describe, expect, it } from "vitest";
import { hasImageSignature, placementProblem, uploadProblem, type PlacementMeta } from "./validate";

const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);

const variant = (over: Partial<PlacementMeta["variants"][string]> = {}) => ({
  x: 0.1,
  y: 0,
  w: 0.8,
  h: 1,
  width: 1280,
  height: 720,
  widths: [640, 1280],
  ...over,
});

const meta = (over: Partial<PlacementMeta> = {}): PlacementMeta => ({
  slot: "home.hero",
  position: 0,
  photo_ref: "bundled:156a0913",
  format: "webp",
  variants: { desktop: variant(), phone: variant({ width: 640, height: 1067, widths: [640] }) },
  ...over,
});

describe("file signatures", () => {
  it("accepts real WebP and JPEG bytes only", () => {
    expect(hasImageSignature(webp, "webp")).toBe(true);
    expect(hasImageSignature(jpg, "jpg")).toBe(true);
    expect(hasImageSignature(jpg, "webp")).toBe(false);
    expect(hasImageSignature(new TextEncoder().encode("<svg onload=alert(1)>"), "webp")).toBe(false);
  });
});

describe("placementProblem", () => {
  it("accepts a valid hero crop with both device variants", () => {
    expect(placementProblem(meta())).toBeNull();
  });

  it("requires exactly the slot's crops", () => {
    expect(placementProblem(meta({ variants: { desktop: variant() } }))).toMatch(/Every crop/);
    expect(placementProblem(meta({ slot: "home.story", variants: { default: variant() } }))).toBeNull();
  });

  it("rejects unknown spots, positions, photos, and crops outside the photo", () => {
    expect(placementProblem(meta({ slot: "nope" }))).toMatch(/Unknown spot/);
    expect(placementProblem(meta({ position: 1 }))).toMatch(/position/);
    expect(placementProblem(meta({ photo_ref: "../../secret" }))).toMatch(/Unknown photo/);
    expect(placementProblem(meta({ variants: { desktop: variant({ x: 0.5, w: 0.8 }), phone: variant() } }))).toMatch(
      /outside/,
    );
  });

  it("rejects unexpected rendition sizes", () => {
    expect(
      placementProblem(meta({ variants: { desktop: variant({ widths: [999, 1280] }), phone: variant() } })),
    ).toMatch(/sizes/);
  });
});

describe("uploadProblem", () => {
  it("allows standard widths, or one small width for small photos", () => {
    expect(uploadProblem({ format: "webp", width: 3000, height: 2000, widths: [640, 1280, 1920] })).toBeNull();
    expect(uploadProblem({ format: "webp", width: 500, height: 400, widths: [500] })).toBeNull();
    expect(uploadProblem({ format: "webp", width: 1000, height: 800, widths: [640, 1280] })).toMatch(/sizes/);
  });
});
