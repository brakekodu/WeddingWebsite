import { getAdmin } from "@/lib/auth/admin";
import { deleteMedia, putMedia } from "@/lib/media/storage";
import { hasImageSignature, MAX_FILE_BYTES, uploadMetaSchema, uploadProblem } from "@/lib/media/validate";

/**
 * Adds a photo to the library: a master copy (for future re-cropping) and
 * full-photo renditions, already resized in the admin's browser. Admin only.
 */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const form = await request.formData();
  const parsed = uploadMetaSchema.safeParse(JSON.parse(String(form.get("meta") ?? "null")));
  if (!parsed.success) return Response.json({ error: "Invalid upload." }, { status: 400 });
  const meta = parsed.data;
  const problem = uploadProblem(meta);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const files: { name: string; file: File }[] = [{ name: "master", file: form.get("master") as File }];
  for (const w of meta.widths) files.push({ name: `full-${w}`, file: form.get(`full-${w}`) as File });

  const id = crypto.randomUUID();
  const prefix = `site/photos/${id}`;
  const written: string[] = [];
  try {
    for (const { name, file } of files) {
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES) {
        throw new UploadError("A photo file is missing or too large.");
      }
      const bytes = await file.arrayBuffer();
      if (!hasImageSignature(new Uint8Array(bytes), meta.format))
        throw new UploadError("That file isn't a valid image.");
      const key = `${prefix}/${name}.${meta.format}`;
      await putMedia(key, bytes, meta.format);
      written.push(key);
    }
    const { error } = await admin.supabase.from("site_photos").insert({
      id,
      storage_prefix: prefix,
      format: meta.format,
      width: meta.width,
      height: meta.height,
      widths: meta.widths,
      original_name: meta.name?.slice(0, 255) ?? null,
    });
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, id });
  } catch (error) {
    await deleteMedia(written);
    if (error instanceof UploadError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Photo upload failed:", error);
    return Response.json({ error: "The upload failed. Please try again." }, { status: 500 });
  }
}

class UploadError extends Error {}
