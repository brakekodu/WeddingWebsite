/**
 * Turns admin choices (placements + uploaded photos) into what a page renders,
 * falling back to the bundled defaults for any spot not customized yet.
 * Pure, so it is unit-tested; the server loads the data (src/lib/media/server.ts).
 */
import { z } from "zod";
import { PHOTOS } from "@/content/photos";
import { slotDef, type SlotKey, type VariantName } from "@/lib/media/slots";

const cropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
  key: z.string().regex(/^site\/crops\/[a-z0-9/._-]+$/),
  format: z.enum(["webp", "jpg"]),
  widths: z.array(z.number().int().positive()).min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const cropsSchema = z.object({
  default: cropSchema.optional(),
  desktop: cropSchema.optional(),
  phone: cropSchema.optional(),
});

export const siteMediaSchema = z.object({
  placements: z.array(
    z.object({
      slot: z.string(),
      position: z.number().int(),
      photo_ref: z.string(),
      crops: cropsSchema.catch({}),
    }),
  ),
  photos: z.array(
    z.object({
      id: z.string(),
      storage_prefix: z.string(),
      format: z.enum(["webp", "jpg"]),
      width: z.number(),
      height: z.number(),
      widths: z.array(z.number()),
      alt: z.string(),
    }),
  ),
});

export type Crop = z.infer<typeof cropSchema>;
export type Crops = z.infer<typeof cropsSchema>;
export type SiteMedia = z.infer<typeof siteMediaSchema>;
export type UploadedPhoto = SiteMedia["photos"][number];

export const EMPTY_MEDIA: SiteMedia = { placements: [], photos: [] };

export interface Rendition {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

export interface ResolvedPhoto {
  /** Stable React key. */
  key: string;
  alt: string;
  /** object-position for uncropped use. */
  focus: string;
  /** The whole photo (lightbox, or when a variant has no crop). */
  full: Rendition;
  variants: Partial<Record<VariantName, Rendition>>;
}

function rendition(urlFor: (w: number) => string, widths: readonly number[], width: number, height: number): Rendition {
  const largest = Math.max(...widths);
  const mid = widths.includes(1280) ? 1280 : largest;
  return {
    src: urlFor(mid),
    srcSet: widths.map((w) => `${urlFor(w)} ${w}w`).join(", "),
    width,
    height,
  };
}

export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

/** The whole photo for a library reference ('bundled:<id>' or an uploaded uuid). */
export function libraryPhoto(
  ref: string,
  uploaded: readonly UploadedPhoto[],
): { ref: string; alt: string; focus: string; full: Rendition; master: string; width: number; height: number } | null {
  if (ref.startsWith("bundled:")) {
    const p = (PHOTOS as Record<string, (typeof PHOTOS)[keyof typeof PHOTOS]>)[ref.slice(8)];
    if (!p) return null;
    const full = rendition((w) => `/photos/${p.id}-${w}.webp`, p.widths, p.width, p.height);
    return {
      ref,
      alt: p.alt,
      focus: p.focus,
      full,
      master: `/photos/${p.id}-${Math.max(...p.widths)}.webp`,
      width: p.width,
      height: p.height,
    };
  }
  const u = uploaded.find((x) => x.id === ref);
  if (!u) return null;
  const full = rendition((w) => mediaUrl(`${u.storage_prefix}/full-${w}.${u.format}`), u.widths, u.width, u.height);
  return {
    ref,
    alt: u.alt,
    focus: "50% 50%",
    full,
    master: mediaUrl(`${u.storage_prefix}/master.${u.format}`),
    width: u.width,
    height: u.height,
  };
}

function cropRendition(crop: Crop): Rendition {
  return rendition((w) => mediaUrl(`${crop.key}-${w}.${crop.format}`), crop.widths, crop.width, crop.height);
}

function fromRef(ref: string, crops: Crops, media: SiteMedia, key: string): ResolvedPhoto | null {
  const base = libraryPhoto(ref, media.photos);
  if (!base) return null;
  const variants: ResolvedPhoto["variants"] = {};
  for (const name of ["default", "desktop", "phone"] as const) {
    const crop = crops[name];
    if (crop) variants[name] = cropRendition(crop);
  }
  return { key, alt: base.alt, focus: base.focus, full: base.full, variants };
}

function defaultPhoto(slot: SlotKey, position: number): ResolvedPhoto {
  const def = slotDef(slot)!;
  const id = def.defaults[position] ?? def.defaults[0];
  return fromRef(`bundled:${id}`, {}, EMPTY_MEDIA, `${slot}:${position}:default`)!;
}

/** One photo for a fixed spot (e.g. the home hero, or strip position 2). */
export function resolveSlot(media: SiteMedia, slot: SlotKey, position = 0): ResolvedPhoto {
  const placement = media.placements.find((p) => p.slot === slot && p.position === position);
  if (placement) {
    const resolved = fromRef(placement.photo_ref, placement.crops, media, `${slot}:${position}:${placement.photo_ref}`);
    if (resolved) return resolved;
  }
  return defaultPhoto(slot, position);
}

/**
 * All photos for a spot. Fixed spots fill each position (placement or default);
 * list spots (gallery) use the admin's list once it exists, else the defaults.
 */
export function resolveSlotList(media: SiteMedia, slot: SlotKey): ResolvedPhoto[] {
  const def = slotDef(slot)!;
  if (!def.list) return def.defaults.map((_, i) => resolveSlot(media, slot, i));
  const placed = media.placements.filter((p) => p.slot === slot).sort((a, b) => a.position - b.position);
  if (placed.length === 0) return def.defaults.map((_, i) => defaultPhoto(slot, i));
  return placed
    .map((p) => fromRef(p.photo_ref, p.crops, media, `${slot}:${p.position}:${p.photo_ref}`))
    .filter((x): x is ResolvedPhoto => x !== null);
}
