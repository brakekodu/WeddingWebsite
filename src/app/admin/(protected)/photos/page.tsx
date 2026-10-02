/* eslint-disable @next/next/no-img-element -- admin thumbnails */
import Link from "next/link";
import { PhotoUploadButton } from "@/components/admin/photo-upload-button";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { libraryItems, loadAdminMedia } from "@/lib/media/admin";
import { resolveSlot, resolveSlotList, type ResolvedPhoto } from "@/lib/media/resolve";
import { SLOT_KEYS, SLOTS, type SlotKey } from "@/lib/media/slots";
import { addToGallery, deletePhoto, moveInGallery, removeFromGallery, resetSlot, updatePhotoAlt } from "./actions";

export const metadata = { title: "Photos" };

/** Smallest image of what a spot shows now (its crop if any), for thumbnails. */
function thumbOf(p: ResolvedPhoto): string {
  const r = p.variants.desktop ?? p.variants.default ?? p.variants.phone ?? p.full;
  return r.srcSet.split(", ")[0].split(" ")[0];
}

export default async function PhotosPage() {
  const { supabase } = await requireAdminPage();
  const media = await loadAdminMedia(supabase);
  const library = libraryItems(media);
  const usedRefs = new Set(media.placements.map((p) => p.photo_ref));
  const gallery = resolveSlotList(media, "gallery");
  const galleryCustomized = media.placements.some((p) => p.slot === "gallery");
  const fixedSlots = SLOT_KEYS.filter((k) => !("list" in SLOTS[k] && SLOTS[k].list));

  return (
    <div className="space-y-8">
      <div>
        <h1 className={ui.h1}>Photos</h1>
        <p className="text-sm text-stone-600">
          Choose the photo for each spot on the website, crop it, and center it. Changes appear on the site as soon as
          you save.
        </p>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>Photos on your website</h2>
        <div className="space-y-6">
          {fixedSlots.map((slot: SlotKey) => {
            const def = SLOTS[slot];
            return (
              <div key={slot} className="border-b border-stone-100 pb-6 last:border-0 last:pb-0">
                <h3 className="font-semibold text-stone-900">{def.label}</h3>
                <p className="mb-3 text-sm text-stone-600">{def.hint}</p>
                <div className="flex flex-wrap gap-4">
                  {def.defaults.map((_, position) => {
                    const photo = resolveSlot(media, slot, position);
                    const customized = media.placements.some((p) => p.slot === slot && p.position === position);
                    return (
                      <div key={position} className="w-44 space-y-2">
                        <img
                          src={thumbOf(photo)}
                          alt={photo.alt}
                          className="aspect-[4/3] w-full rounded-md object-cover"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/photos/edit/${slot}/${position}`}
                            className={`${ui.buttonSecondary} px-3 py-1.5`}
                          >
                            Change &amp; crop
                          </Link>
                          {customized && (
                            <ActionForm
                              inline
                              variant="secondary"
                              action={resetSlot.bind(null, slot, position)}
                              submitLabel="Use original"
                              confirm="Put the original photo back in this spot?"
                            />
                          )}
                        </div>
                        {def.defaults.length > 1 && <p className="text-xs text-stone-500">Photo {position + 1}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={ui.card}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={ui.h2}>Gallery ({gallery.length})</h2>
          {!galleryCustomized && <Badge>Showing the original selection</Badge>}
        </div>
        <p className="mb-4 text-sm text-stone-600">{SLOTS.gallery.hint}</p>
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {gallery.map((photo, position) => (
            <li key={photo.key} className="space-y-2">
              <img src={thumbOf(photo)} alt={photo.alt} className="aspect-[3/4] w-full rounded-md object-cover" />
              <p className="text-xs text-stone-500">#{position + 1}</p>
              <div className="flex flex-wrap gap-1">
                <ActionForm
                  inline
                  variant="secondary"
                  action={moveInGallery.bind(null, position, -1)}
                  submitLabel="↑"
                />
                <ActionForm inline variant="secondary" action={moveInGallery.bind(null, position, 1)} submitLabel="↓" />
                <Link href={`/admin/photos/edit/gallery/${position}`} className={`${ui.buttonSecondary} px-3 py-2`}>
                  Crop
                </Link>
                <ActionForm
                  inline
                  variant="danger"
                  action={removeFromGallery.bind(null, position)}
                  submitLabel="Remove"
                  confirm="Remove this photo from the gallery? (It stays in your library.)"
                />
              </div>
            </li>
          ))}
        </ol>
        <details className="mt-6">
          <summary className="cursor-pointer font-medium text-stone-800">Add photos to the gallery</summary>
          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {library.map((item) => (
              <li key={item.ref} className="space-y-1">
                <img src={item.thumb} alt={item.alt} className="aspect-square w-full rounded object-cover" />
                <ActionForm inline variant="secondary" action={addToGallery.bind(null, item.ref)} submitLabel="Add" />
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-1`}>Photo library</h2>
        <p className="mb-4 text-sm text-stone-600">
          Upload from your computer or phone. Large photos are shrunk automatically before uploading, and location data
          is removed.
        </p>
        <PhotoUploadButton />
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {library.map((item) => (
            <li key={item.ref} className="space-y-2 rounded-lg border border-stone-200 p-3">
              <img src={item.thumb} alt={item.alt} className="aspect-[4/3] w-full rounded object-cover" />
              <div className="flex flex-wrap gap-1">
                {item.uploaded ? <Badge tone="info">Uploaded</Badge> : <Badge>Engagement shoot</Badge>}
                {usedRefs.has(item.ref) && <Badge tone="good">On the site</Badge>}
              </div>
              {item.uploaded ? (
                <>
                  <ActionForm action={updatePhotoAlt.bind(null, item.ref)} submitLabel="Save" className="space-y-2">
                    <label className="block text-xs text-stone-600">
                      Description (read aloud to blind visitors)
                      <input name="alt" defaultValue={item.alt} maxLength={300} className={ui.input} />
                    </label>
                  </ActionForm>
                  {!usedRefs.has(item.ref) && (
                    <ActionForm
                      inline
                      variant="danger"
                      action={deletePhoto.bind(null, item.ref)}
                      submitLabel="Delete"
                      confirm="Delete this photo from the library?"
                    />
                  )}
                </>
              ) : (
                <p className="text-xs text-stone-600">{item.alt}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
