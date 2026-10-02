"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ui } from "@/components/ui/styles";
import { prepareUpload } from "@/lib/media/client-images";

/**
 * Adds photos to the library. Each photo is resized in the browser (even huge
 * camera originals), then uploaded to the site's private photo storage.
 */
export function PhotoUploadButton({ onUploaded }: { onUploaded?: (id: string) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList) {
    setBusy(true);
    let done = 0;
    try {
      for (const file of Array.from(files)) {
        setStatus({ text: `Preparing ${file.name} (${done + 1} of ${files.length})…` });
        const prepared = await prepareUpload(file);
        setStatus({ text: `Uploading ${file.name} (${done + 1} of ${files.length})…` });
        const form = new FormData();
        form.set(
          "meta",
          JSON.stringify({
            format: prepared.format,
            width: prepared.width,
            height: prepared.height,
            widths: prepared.full.files.map((f) => f.width),
            name: file.name,
          }),
        );
        form.set("master", prepared.master, `master.${prepared.format}`);
        for (const f of prepared.full.files) form.set(f.name, f.blob, `${f.name}.${prepared.format}`);
        const res = await fetch("/admin/photos/upload", { method: "POST", body: form });
        const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !body.id) throw new Error(body.error ?? "The upload failed.");
        done++;
        onUploaded?.(body.id);
      }
      setStatus({ text: done === 1 ? "Photo added." : `${done} photos added.` });
      router.refresh();
    } catch (error) {
      setStatus({ text: `${(error as Error).message} ${done ? `(${done} uploaded before this.)` : ""}`, error: true });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="sr-only"
        id="photo-upload"
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
        disabled={busy}
      />
      <label
        htmlFor="photo-upload"
        className={`${ui.button} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        {busy ? "Working…" : "Upload photos"}
      </label>
      {status && (
        <p
          role={status.error ? "alert" : "status"}
          className={`text-sm ${status.error ? "text-red-700" : "text-stone-600"}`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
