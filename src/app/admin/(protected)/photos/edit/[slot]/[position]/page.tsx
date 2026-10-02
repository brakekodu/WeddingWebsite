import Link from "next/link";
import { notFound } from "next/navigation";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { libraryItems, loadAdminMedia } from "@/lib/media/admin";
import { resolveSlotList } from "@/lib/media/resolve";
import { isValidPosition, slotDef, SLOTS, variantNames, type SlotKey } from "@/lib/media/slots";
import { SlotEditor, type EditorVariant } from "./slot-editor";

export const metadata = { title: "Change & crop photo" };

const VARIANT_LABELS = { default: "Crop", desktop: "On computers", phone: "On phones" } as const;

export default async function EditSlotPage(props: PageProps<"/admin/photos/edit/[slot]/[position]">) {
  const { slot, position: rawPosition } = await props.params;
  const def = slotDef(slot);
  const position = Number(rawPosition);
  if (!def || !isValidPosition(def, position)) notFound();

  const { supabase } = await requireAdminPage();
  const media = await loadAdminMedia(supabase);
  if (def.list && position >= resolveSlotList(media, slot as SlotKey).length) notFound();

  const placement = media.placements.find((p) => p.slot === slot && p.position === position);
  // Gallery before customization shows its defaults in order.
  const currentRef = placement?.photo_ref ?? `bundled:${def.defaults[position] ?? def.defaults[0]}`;
  const savedCrops = Object.fromEntries(
    Object.entries(placement?.crops ?? {}).map(([name, c]) => [name, c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null]),
  );

  const variants: EditorVariant[] = variantNames(def).map((name) => ({
    name,
    label: VARIANT_LABELS[name],
    aspect: def.variants[name]!,
  }));
  const title = def.defaults.length > 1 && !def.list ? `${def.label} — photo ${position + 1}` : def.label;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/photos" className="text-sm text-stone-600 hover:underline">
          ← Photos
        </Link>
        <h1 className={ui.h1}>{slot === "gallery" ? `${SLOTS.gallery.label} — photo ${position + 1}` : title}</h1>
        <p className="text-sm text-stone-600">{def.hint}</p>
      </div>
      <SlotEditor
        slot={slot}
        position={position}
        variants={variants}
        library={libraryItems(media)}
        currentRef={currentRef}
        savedCrops={savedCrops}
      />
    </div>
  );
}
