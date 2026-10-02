/** Validation for files and metadata posted by Admin → Photos. Pure; unit-tested. */
import { z } from "zod";
import { RENDITION_WIDTHS, slotDef, isValidPosition, variantNames, type VariantName } from "@/lib/media/slots";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** True when the bytes really are the claimed image type (not just the declared name). */
export function hasImageSignature(bytes: Uint8Array, format: "webp" | "jpg"): boolean {
  if (format === "jpg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  return bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

const widthSchema = z.number().int().min(1).max(4000);
const allowedWidth = (w: number, largest: number) =>
  (RENDITION_WIDTHS as readonly number[]).includes(w) || (w === largest && w < RENDITION_WIDTHS[0]);

export const uploadMetaSchema = z.object({
  format: z.enum(["webp", "jpg"]),
  width: widthSchema,
  height: widthSchema,
  widths: z.array(widthSchema).min(1).max(RENDITION_WIDTHS.length),
  name: z.string().max(255).optional(),
});

const fraction = z.number().min(0).max(1);
const variantMetaSchema = z.object({
  x: fraction,
  y: fraction,
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
  width: widthSchema,
  height: widthSchema,
  widths: z.array(widthSchema).min(1).max(RENDITION_WIDTHS.length),
});

export const placementMetaSchema = z.object({
  slot: z.string().max(40),
  position: z.number().int(),
  photo_ref: z.string().max(60),
  format: z.enum(["webp", "jpg"]),
  variants: z.record(z.string(), variantMetaSchema),
});

export type PlacementMeta = z.infer<typeof placementMetaSchema>;

/** Checks a crop submission against the slot's definition. Returns an error message or null. */
export function placementProblem(meta: PlacementMeta): string | null {
  const def = slotDef(meta.slot);
  if (!def) return "Unknown spot on the site.";
  if (!isValidPosition(def, meta.position)) return "That position doesn't exist.";
  if (
    !/^(bundled:[a-z0-9-]{1,40}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(meta.photo_ref)
  ) {
    return "Unknown photo.";
  }
  const expected = variantNames(def).sort().join(",");
  const given = Object.keys(meta.variants).sort().join(",");
  if (expected !== given) return "Every crop for this spot is required.";
  for (const [name, v] of Object.entries(meta.variants)) {
    if (v.x + v.w > 1.0001 || v.y + v.h > 1.0001) return `The ${name} crop goes outside the photo.`;
    const largest = Math.max(...v.widths);
    if (largest !== v.width || !v.widths.every((w) => allowedWidth(w, largest))) return "Unexpected image sizes.";
  }
  return null;
}

export function uploadProblem(meta: z.infer<typeof uploadMetaSchema>): string | null {
  const largest = Math.max(...meta.widths);
  if (!meta.widths.every((w) => allowedWidth(w, largest) && w <= meta.width)) return "Unexpected image sizes.";
  return null;
}

export type { VariantName };
