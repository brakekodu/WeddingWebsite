import { getMedia } from "@/lib/media/storage";

/**
 * Serves website photos from R2. Only keys under site/ in the expected shapes
 * are readable; everything else (including future guest uploads) is not.
 * Keys are unique per upload/crop, so responses can be cached forever.
 */
export async function GET(request: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  const object = await getMedia(key);
  if (!object) return new Response("Not found", { status: 404 });

  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers: { ETag: object.httpEtag } });
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
