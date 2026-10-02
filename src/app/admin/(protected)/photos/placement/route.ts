import { PHOTOS } from "@/content/photos";
import { getAdmin } from "@/lib/auth/admin";
import { cropFileKeys, ensureGalleryRows } from "@/lib/media/admin";
import { cropsSchema, type Crops } from "@/lib/media/resolve";
import { deleteMedia, putMedia } from "@/lib/media/storage";
import { hasImageSignature, MAX_FILE_BYTES, placementMetaSchema, placementProblem } from "@/lib/media/validate";

const bad = (error: string) => Response.json({ error }, { status: 400 });

/**
 * Puts a photo in a spot on the site with the admin's crop(s). The cropped
 * images were rendered in the browser; this validates every file first, stores
 * them in R2 under fresh keys (so caches never show an old crop), records the
 * placement, then removes the replaced files. Admin only.
 */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const { supabase } = admin;

  const form = await request.formData();
  const parsed = placementMetaSchema.safeParse(JSON.parse(String(form.get("meta") ?? "null")));
  if (!parsed.success) return bad("Invalid request.");
  const meta = parsed.data;
  const problem = placementProblem(meta);
  if (problem) return bad(problem);

  // The photo must exist: bundled with the site, or uploaded to the library.
  if (meta.photo_ref.startsWith("bundled:")) {
    if (!(meta.photo_ref.slice(8) in PHOTOS)) return bad("Unknown photo.");
  } else {
    const { data } = await supabase.from("site_photos").select("id").eq("id", meta.photo_ref).maybeSingle();
    if (!data) return bad("That photo was removed from the library.");
  }

  // 1. Validate every file before writing anything.
  const nonce = crypto.randomUUID().slice(0, 8);
  const crops: Crops = {};
  const uploads: { key: string; bytes: ArrayBuffer }[] = [];
  for (const [variant, v] of Object.entries(meta.variants)) {
    const key = `site/crops/${meta.slot}/${meta.position}/${variant}-${nonce}`;
    for (const w of v.widths) {
      const file = form.get(`${variant}-${w}`);
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES) {
        return bad("A cropped image is missing or too large.");
      }
      const bytes = await file.arrayBuffer();
      if (!hasImageSignature(new Uint8Array(bytes), meta.format)) return bad("That file isn't a valid image.");
      uploads.push({ key: `${key}-${w}.${meta.format}`, bytes });
    }
    crops[variant as keyof Crops] = { ...v, key, format: meta.format };
  }

  // 2. Write, record, clean up.
  const written: string[] = [];
  try {
    for (const u of uploads) {
      await putMedia(u.key, u.bytes, meta.format);
      written.push(u.key);
    }
    if (meta.slot === "gallery") await ensureGalleryRows(supabase);
    const { data: previous } = await supabase
      .from("site_placements")
      .select("crops")
      .eq("slot", meta.slot)
      .eq("position", meta.position)
      .maybeSingle();
    const { error } = await supabase
      .from("site_placements")
      .upsert(
        { slot: meta.slot, position: meta.position, photo_ref: meta.photo_ref, crops },
        { onConflict: "slot,position" },
      );
    if (error) throw new Error(error.message);
    if (previous) await deleteMedia(cropFileKeys(cropsSchema.catch({}).parse(previous.crops)));
    return Response.json({ ok: true });
  } catch (error) {
    await deleteMedia(written);
    console.error("Saving placement failed:", error);
    return Response.json({ error: "Saving failed. Please try again." }, { status: 500 });
  }
}
