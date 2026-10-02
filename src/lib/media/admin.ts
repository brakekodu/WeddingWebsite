/**
 * Server-side helpers for Admin → Photos (always called after requireAdmin()).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTOS } from "@/content/photos";
import { cropsSchema, libraryPhoto, type Crops, type SiteMedia } from "@/lib/media/resolve";
import { SLOTS } from "@/lib/media/slots";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Everything the admin pages need: all placements and every uploaded photo (placed or not). */
export async function loadAdminMedia(supabase: Client): Promise<SiteMedia> {
  const [placements, photos] = await Promise.all([
    supabase.from("site_placements").select("slot, position, photo_ref, crops").order("slot").order("position"),
    supabase.from("site_photos").select("*").order("created_at", { ascending: false }),
  ]);
  if (placements.error) throw new Error(placements.error.message);
  if (photos.error) throw new Error(photos.error.message);
  return {
    placements: placements.data.map((p) => ({ ...p, crops: cropsSchema.catch({}).parse(p.crops) })),
    photos: photos.data.map((p) => ({
      id: p.id,
      storage_prefix: p.storage_prefix,
      format: p.format,
      width: p.width,
      height: p.height,
      widths: p.widths,
      alt: p.alt,
    })),
  };
}

export interface LibraryItem {
  ref: string;
  alt: string;
  thumb: string;
  master: string;
  width: number;
  height: number;
  uploaded: boolean;
}

/** The photo library: your uploads first, then the bundled engagement photos. */
export function libraryItems(media: SiteMedia): LibraryItem[] {
  const refs = [...media.photos.map((p) => p.id), ...Object.keys(PHOTOS).map((id) => `bundled:${id}`)];
  return refs.flatMap((ref) => {
    const p = libraryPhoto(ref, media.photos);
    if (!p) return [];
    const thumb = p.full.srcSet.split(", ")[0].split(" ")[0];
    return [
      {
        ref,
        alt: p.alt,
        thumb,
        master: p.master,
        width: p.width,
        height: p.height,
        uploaded: !ref.startsWith("bundled:"),
      },
    ];
  });
}

/** R2 keys of every file a placement's crops produced. */
export function cropFileKeys(crops: Crops): string[] {
  return Object.values(crops).flatMap((c) => (c ? c.widths.map((w) => `${c.key}-${w}.${c.format}`) : []));
}

/**
 * The gallery shows the default photos until it is first edited; editing it
 * turns the defaults into real rows so they can be reordered or removed.
 */
export async function ensureGalleryRows(supabase: Client): Promise<void> {
  const { count, error } = await supabase
    .from("site_placements")
    .select("id", { count: "exact", head: true })
    .eq("slot", "gallery");
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return;
  const { error: insertError } = await supabase
    .from("site_placements")
    .insert(SLOTS.gallery.defaults.map((id, position) => ({ slot: "gallery", position, photo_ref: `bundled:${id}` })));
  if (insertError) throw new Error(insertError.message);
}

/** Most photos the gallery may hold (keeps reorder's temporary positions within range). */
export const GALLERY_MAX = 200;

/** Renumbers gallery rows 0..n-1 in the given order (two passes avoid unique-key clashes). */
export async function writeGalleryOrder(supabase: Client, orderedIds: string[]): Promise<void> {
  for (const offset of [250, 0]) {
    for (const [i, id] of orderedIds.entries()) {
      const { error } = await supabase
        .from("site_placements")
        .update({ position: offset + i })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }
  }
}
