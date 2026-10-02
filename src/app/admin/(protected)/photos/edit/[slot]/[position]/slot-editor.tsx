"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails */
import { useRouter } from "next/navigation";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { PhotoUploadButton } from "@/components/admin/photo-upload-button";
import { ui } from "@/components/ui/styles";
import type { LibraryItem } from "@/lib/media/admin";
import { decodeUrl, renderRenditions, type RenderedSet } from "@/lib/media/client-images";
import type { VariantName } from "@/lib/media/slots";

export interface EditorVariant {
  name: VariantName;
  label: string;
  aspect: number;
}

/** Crop as fractions of the photo (0–1). */
type Fractions = { x: number; y: number; w: number; h: number };

interface VariantState {
  crop: { x: number; y: number };
  zoom: number;
  /** Percent area reported by the cropper (0–100), restored when switching tabs. */
  area: Area | null;
}

/** The largest centered crop with the given aspect ratio, as percentages. */
function centeredArea(photoW: number, photoH: number, aspect: number): Area {
  const photoAspect = photoW / photoH;
  if (photoAspect > aspect) {
    const width = (aspect / photoAspect) * 100;
    return { x: (100 - width) / 2, y: 0, width, height: 100 };
  }
  const height = (photoAspect / aspect) * 100;
  return { x: 0, y: (100 - height) / 2, width: 100, height };
}

export function SlotEditor({
  slot,
  position,
  variants,
  library,
  currentRef,
  savedCrops,
}: {
  slot: string;
  position: number;
  variants: EditorVariant[];
  library: LibraryItem[];
  currentRef: string;
  savedCrops: Record<string, Fractions | null>;
}) {
  const router = useRouter();
  const [ref, setRef] = useState(currentRef);
  const [tab, setTab] = useState<VariantName>(variants[0].name);
  const initialStates = (forRef: string): Record<string, VariantState> =>
    Object.fromEntries(
      variants.map((v) => {
        const saved = forRef === currentRef ? savedCrops[v.name] : null;
        const area = saved ? { x: saved.x * 100, y: saved.y * 100, width: saved.w * 100, height: saved.h * 100 } : null;
        return [v.name, { crop: { x: 0, y: 0 }, zoom: 1, area }];
      }),
    );
  const [states, setStates] = useState<Record<string, VariantState>>(() => initialStates(currentRef));
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const photo = library.find((p) => p.ref === ref) ?? library[0];
  const variant = variants.find((v) => v.name === tab)!;
  const state = states[tab];
  const update = (patch: Partial<VariantState>) => setStates((s) => ({ ...s, [tab]: { ...s[tab], ...patch } }));

  function choose(nextRef: string) {
    setRef(nextRef);
    setStates(initialStates(nextRef));
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setStatus({ text: "Preparing your crop…" });
    try {
      const bitmap = await decodeUrl(photo.master);
      const form = new FormData();
      const metaVariants: Record<string, unknown> = {};
      let format: RenderedSet["format"] | null = null;
      for (const v of variants) {
        const area = states[v.name].area ?? centeredArea(photo.width, photo.height, v.aspect);
        const rect = {
          x: (area.x / 100) * bitmap.width,
          y: (area.y / 100) * bitmap.height,
          width: (area.width / 100) * bitmap.width,
          height: (area.height / 100) * bitmap.height,
        };
        const set = await renderRenditions(bitmap, rect, v.name);
        if (format && set.format !== format) throw new Error("This browser could not process the photo consistently.");
        format = set.format;
        for (const f of set.files) form.set(f.name, f.blob, `${f.name}.${set.format}`);
        metaVariants[v.name] = {
          x: area.x / 100,
          y: area.y / 100,
          w: Math.min(area.width / 100, 1 - area.x / 100),
          h: Math.min(area.height / 100, 1 - area.y / 100),
          width: set.width,
          height: set.height,
          widths: set.files.map((f) => f.width),
        };
      }
      bitmap.close();
      form.set("meta", JSON.stringify({ slot, position, photo_ref: ref, format, variants: metaVariants }));
      setStatus({ text: "Saving to the website…" });
      const res = await fetch("/admin/photos/placement", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Saving failed.");
      setStatus({ text: "Saved! It's live on the website." });
      router.push("/admin/photos");
      router.refresh();
    } catch (error) {
      setStatus({ text: (error as Error).message, error: true });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-1`}>1. Choose a photo</h2>
        <p className="mb-4 text-sm text-stone-600">Tap a photo to use it here, or upload a new one.</p>
        <PhotoUploadButton onUploaded={(id) => choose(id)} />
        <ul className="mt-4 grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 lg:grid-cols-10">
          {library.map((item) => (
            <li key={item.ref}>
              <button
                type="button"
                onClick={() => choose(item.ref)}
                aria-pressed={item.ref === ref}
                aria-label={item.alt || "Photo"}
                className={`block w-full overflow-hidden rounded-md ring-offset-2 ${item.ref === ref ? "ring-4 ring-[#6f5a8f]" : "hover:opacity-80"}`}
              >
                <img src={item.thumb} alt="" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-1`}>2. Crop &amp; center</h2>
        <p className="mb-4 text-sm text-stone-600">
          Drag the photo to center it, and zoom with the slider (or pinch on a phone). The frame shows exactly what
          visitors will see.
          {variants.length > 1 && " This spot is shaped differently on computers and phones, so set both."}
        </p>
        {variants.length > 1 && (
          <div role="tablist" aria-label="Device" className="mb-3 flex gap-2">
            {variants.map((v) => (
              <button
                key={v.name}
                role="tab"
                type="button"
                aria-selected={tab === v.name}
                onClick={() => setTab(v.name)}
                className={tab === v.name ? ui.button : ui.buttonSecondary}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
        <div className="relative h-[55vh] min-h-72 overflow-hidden rounded-lg bg-stone-900">
          <Cropper
            key={`${ref}-${tab}`}
            image={photo.master}
            aspect={variant.aspect}
            crop={state.crop}
            zoom={state.zoom}
            maxZoom={4}
            objectFit="contain"
            initialCroppedAreaPercentages={state.area ?? undefined}
            onCropChange={(crop) => update({ crop })}
            onZoomChange={(zoom) => update({ zoom })}
            onCropComplete={(area) => update({ area })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex flex-1 items-center gap-3 text-sm text-stone-700">
            Zoom
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={state.zoom}
              onChange={(e) => update({ zoom: Number(e.target.value) })}
              className="w-full max-w-sm accent-[#6f5a8f]"
              aria-label="Zoom"
            />
          </label>
          <button
            type="button"
            className={ui.buttonSecondary}
            onClick={() => setStates((s) => ({ ...s, [tab]: { crop: { x: 0, y: 0 }, zoom: 1, area: null } }))}
          >
            Reset
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className={ui.button}>
          {saving ? "Saving…" : "Save to website"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/photos")}
          className={ui.buttonSecondary}
          disabled={saving}
        >
          Cancel
        </button>
        {status && (
          <p
            role={status.error ? "alert" : "status"}
            className={`text-sm ${status.error ? "text-red-700" : "text-stone-700"}`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}
