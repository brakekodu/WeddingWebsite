/**
 * Browser-side image processing for Admin → Photos. Photos are decoded,
 * cropped, and resized on the admin's own device, so even 40 MB camera
 * originals turn into small web files before anything is uploaded.
 * (Browser only — uses canvas.)
 */
import { RENDITION_WIDTHS } from "@/lib/media/slots";

export type ImageFormat = "webp" | "jpg";

/** Longest edge of the stored master copy (used later for re-cropping). */
export const MASTER_MAX = 3000;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Decodes a file with its camera orientation applied. */
export function decodeFile(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export async function decodeUrl(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the photo (${res.status}).`);
  return createImageBitmap(await res.blob());
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

/**
 * Draws `rect` of `source` at `outWidth` wide, halving in steps for sharp,
 * alias-free downscaling of very large photos.
 */
function resample(source: CanvasImageSource, rect: Rect, outWidth: number): HTMLCanvasElement {
  const outHeight = (rect.height / rect.width) * outWidth;
  // Start no larger than 4096px wide (memory), then halve toward the target.
  let w = Math.min(rect.width, Math.max(outWidth, 4096));
  let current = canvas(w, (rect.height / rect.width) * w);
  let ctx = current.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, current.width, current.height);
  while (w / 2 >= outWidth) {
    w /= 2;
    const next = canvas(w, (rect.height / rect.width) * w);
    ctx = next.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  if (current.width === Math.round(outWidth)) return current;
  const final = canvas(outWidth, outHeight);
  ctx = final.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, final.width, final.height);
  return final;
}

function toBlob(c: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => c.toBlob(resolve, type, quality));
}

/** WebP where the browser can encode it (Chrome, Edge, Firefox); JPEG otherwise (older Safari). */
async function encode(c: HTMLCanvasElement, preferred: ImageFormat): Promise<{ blob: Blob; format: ImageFormat }> {
  if (preferred === "webp") {
    const webp = await toBlob(c, "image/webp", 0.82);
    if (webp && webp.type === "image/webp") return { blob: webp, format: "webp" };
  }
  const jpg = await toBlob(c, "image/jpeg", 0.85);
  if (!jpg) throw new Error("This browser could not process the photo.");
  return { blob: jpg, format: "jpg" };
}

export interface RenderedSet {
  format: ImageFormat;
  /** Rendered size of the largest file. */
  width: number;
  height: number;
  files: { name: string; width: number; blob: Blob }[];
}

/** Renders a region at each standard width (never upscaling), all in one format. */
export async function renderRenditions(
  source: CanvasImageSource,
  rect: Rect,
  namePrefix: string,
): Promise<RenderedSet> {
  const widths: number[] = RENDITION_WIDTHS.filter((w) => w <= rect.width);
  if (widths.length === 0) widths.push(Math.max(1, Math.floor(rect.width)));
  let format: ImageFormat = "webp";
  const files: RenderedSet["files"] = [];
  for (const w of widths) {
    const out = await encode(resample(source, rect, w), format);
    format = out.format; // stay consistent once a fallback happens
    files.push({ name: `${namePrefix}-${w}`, width: w, blob: out.blob });
  }
  const largest = widths.at(-1)!;
  return { format, width: largest, height: Math.round((rect.height / rect.width) * largest), files };
}

/** Prepares an uploaded photo: a master (≤3000px) plus full-photo renditions. */
export async function prepareUpload(file: File) {
  const bitmap = await decodeFile(file);
  try {
    const scale = Math.min(1, MASTER_MAX / Math.max(bitmap.width, bitmap.height));
    const masterW = Math.round(bitmap.width * scale);
    const masterH = Math.round(bitmap.height * scale);
    const masterCanvas = resample(bitmap, { x: 0, y: 0, width: bitmap.width, height: bitmap.height }, masterW);
    const full = await renderRenditions(masterCanvas, { x: 0, y: 0, width: masterW, height: masterH }, "full");
    // Same format as the renditions (WebP, or JPEG where WebP encoding isn't available).
    const master = await encode(masterCanvas, full.format);
    return { width: masterW, height: masterH, format: full.format, master: master.blob, full };
  } finally {
    bitmap.close();
  }
}
