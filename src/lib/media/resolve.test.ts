import { describe, expect, it } from "vitest";
import { PHOTOS } from "@/content/photos";
import { EMPTY_MEDIA, resolveSlot, resolveSlotList, type SiteMedia } from "./resolve";
import { isValidPosition, renditionWidths, SLOTS, slotDef } from "./slots";

const UPLOADED = "11111111-2222-4333-8444-555555555555";

const crop = (key: string, width: number, height: number) => ({
  x: 0.1,
  y: 0.2,
  w: 0.5,
  h: 0.5,
  key,
  format: "webp" as const,
  widths: [640, 1280],
  width,
  height,
});

const media: SiteMedia = {
  placements: [
    {
      slot: "home.hero",
      position: 0,
      photo_ref: UPLOADED,
      crops: {
        desktop: crop("site/crops/home.hero/0/desktop-aaaa1111", 1280, 720),
        phone: crop("site/crops/home.hero/0/phone-bbbb2222", 768, 1280),
      },
    },
    { slot: "home.strip", position: 2, photo_ref: "bundled:156a0506", crops: {} },
    { slot: "gallery", position: 1, photo_ref: "bundled:i4a9825", crops: {} },
    {
      slot: "gallery",
      position: 0,
      photo_ref: UPLOADED,
      crops: { default: crop("site/crops/gallery/0/default-cccc3333", 960, 1280) },
    },
    { slot: "home.story", position: 0, photo_ref: "bundled:does-not-exist", crops: {} },
  ],
  photos: [
    {
      id: UPLOADED,
      storage_prefix: `site/photos/${UPLOADED}`,
      format: "webp",
      width: 3000,
      height: 2000,
      widths: [640, 1280, 1920],
      alt: "Beach day",
    },
  ],
};

describe("resolveSlot", () => {
  it("uses bundled defaults when nothing is customized", () => {
    const hero = resolveSlot(EMPTY_MEDIA, "home.hero");
    expect(hero.full.src).toBe("/photos/156a0913-1280.webp");
    expect(hero.full.srcSet).toContain("/photos/156a0913-1920.webp 1920w");
    expect(hero.variants).toEqual({});
    expect(hero.focus).toBe("53% 30%");
  });

  it("uses an uploaded photo with separate desktop and phone crops from R2", () => {
    const hero = resolveSlot(media, "home.hero");
    expect(hero.alt).toBe("Beach day");
    expect(hero.variants.desktop?.srcSet).toBe(
      "/media/site/crops/home.hero/0/desktop-aaaa1111-640.webp 640w, /media/site/crops/home.hero/0/desktop-aaaa1111-1280.webp 1280w",
    );
    expect(hero.variants.phone?.width).toBe(768);
    expect(hero.full.src).toBe(`/media/site/photos/${UPLOADED}/full-1280.webp`);
  });

  it("falls back to the default when a placement points at a missing photo", () => {
    expect(resolveSlot(media, "home.story").full.src).toBe("/photos/156a0765-1280.webp");
  });
});

describe("resolveSlotList", () => {
  it("fills fixed spots position by position", () => {
    const strip = resolveSlotList(media, "home.strip").map((p) => p.full.src);
    expect(strip).toEqual([
      "/photos/156a1335-1280.webp",
      "/photos/156a1282-1280.webp",
      "/photos/156a0506-1280.webp",
      "/photos/156a1428-1280.webp",
    ]);
  });

  it("uses the admin's gallery list in position order once it exists", () => {
    const gallery = resolveSlotList(media, "gallery");
    expect(gallery.map((p) => p.alt)).toEqual(["Beach day", expect.stringContaining("memorial wall")]);
    expect(gallery[0].variants.default?.src).toContain("default-cccc3333-1280.webp");
  });

  it("shows the default gallery before any customization", () => {
    expect(resolveSlotList(EMPTY_MEDIA, "gallery")).toHaveLength(SLOTS.gallery.defaults.length);
  });
});

describe("slots", () => {
  it("validates positions", () => {
    expect(isValidPosition(slotDef("home.strip")!, 3)).toBe(true);
    expect(isValidPosition(slotDef("home.strip")!, 4)).toBe(false);
    expect(isValidPosition(slotDef("gallery")!, 40)).toBe(true);
    expect(isValidPosition(slotDef("home.hero")!, -1)).toBe(false);
    expect(slotDef("nope")).toBeNull();
  });

  it("never upscales renditions", () => {
    expect(renditionWidths(3000)).toEqual([640, 1280, 1920]);
    expect(renditionWidths(1000)).toEqual([640]);
    expect(renditionWidths(400)).toEqual([400]);
  });

  it("every default refers to a bundled photo that exists", () => {
    for (const def of Object.values(SLOTS)) {
      expect(def.defaults.length).toBeGreaterThan(0);
      for (const id of def.defaults) expect(Object.keys(PHOTOS)).toContain(id);
    }
  });
});
