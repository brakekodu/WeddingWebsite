"use server";

import type { ActionState } from "@/lib/admin/action-state";
import type { AdminContext } from "@/lib/auth/admin";
import { formText, runAdminAction, throwIfDbError, UserFacingError } from "@/lib/admin/actions";
import { cropFileKeys, ensureGalleryRows, GALLERY_MAX, writeGalleryOrder } from "@/lib/media/admin";
import { cropsSchema } from "@/lib/media/resolve";
import { slotDef, isValidPosition } from "@/lib/media/slots";
import { deleteMedia } from "@/lib/media/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REF = /^(bundled:[a-z0-9-]{1,40}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export async function updatePhotoAlt(photoId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    if (!UUID.test(photoId)) throw new UserFacingError("Unknown photo.");
    const alt = formText(fd, "alt");
    if (alt.length > 300) throw new UserFacingError("Please keep the description under 300 characters.");
    const { error } = await supabase.from("site_photos").update({ alt }).eq("id", photoId);
    throwIfDbError(error, "The description");
    return "Description saved.";
  });
}

export async function deletePhoto(photoId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    if (!UUID.test(photoId)) throw new UserFacingError("Unknown photo.");
    const { data: photo } = await supabase.from("site_photos").select("*").eq("id", photoId).maybeSingle();
    if (!photo) throw new UserFacingError("That photo is already gone.");
    const { error } = await supabase.from("site_photos").delete().eq("id", photoId);
    throwIfDbError(error, "Deleting the photo");
    await deleteMedia([
      `${photo.storage_prefix}/master.${photo.format}`,
      ...photo.widths.map((w) => `${photo.storage_prefix}/full-${w}.${photo.format}`),
    ]);
    return "Photo deleted.";
  });
}

/** Puts a spot back to its original photo (fixed spots only). */
export async function resetSlot(slot: string, position: number, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const def = slotDef(slot);
    if (!def || def.list || !isValidPosition(def, position)) throw new UserFacingError("Unknown spot.");
    const { data } = await supabase
      .from("site_placements")
      .delete()
      .eq("slot", slot)
      .eq("position", position)
      .select("crops");
    for (const row of data ?? []) await deleteMedia(cropFileKeys(cropsSchema.catch({}).parse(row.crops)));
    return "Back to the original photo.";
  });
}

async function galleryRows(supabase: AdminContext["supabase"]) {
  await ensureGalleryRows(supabase);
  const { data, error } = await supabase
    .from("site_placements")
    .select("id, position, crops")
    .eq("slot", "gallery")
    .order("position");
  throwIfDbError(error, "Loading the gallery");
  return data!;
}

export async function addToGallery(photoRef: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    if (!REF.test(photoRef)) throw new UserFacingError("Unknown photo.");
    const rows = await galleryRows(supabase);
    if (rows.length >= GALLERY_MAX) throw new UserFacingError(`The gallery holds up to ${GALLERY_MAX} photos.`);
    const position = rows.length ? rows.at(-1)!.position + 1 : 0;
    const { error } = await supabase.from("site_placements").insert({ slot: "gallery", position, photo_ref: photoRef });
    throwIfDbError(error, "Adding the photo");
    return "Added to the gallery.";
  });
}

export async function removeFromGallery(position: number, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const rows = await galleryRows(supabase);
    const row = rows.find((r) => r.position === position);
    if (!row) throw new UserFacingError("That photo is no longer in the gallery.");
    if (rows.length === 1) throw new UserFacingError("The gallery needs at least one photo.");
    const { error } = await supabase.from("site_placements").delete().eq("id", row.id);
    throwIfDbError(error, "Removing the photo");
    await deleteMedia(cropFileKeys(cropsSchema.catch({}).parse(row.crops)));
    await writeGalleryOrder(
      supabase,
      rows.filter((r) => r.id !== row.id).map((r) => r.id),
    );
    return "Removed from the gallery.";
  });
}

export async function moveInGallery(position: number, direction: -1 | 1, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const rows = await galleryRows(supabase);
    const i = rows.findIndex((r) => r.position === position);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return "Already at the end.";
    const ids = rows.map((r) => r.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await writeGalleryOrder(supabase, ids);
    return "Moved.";
  });
}
