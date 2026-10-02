import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { EMPTY_MEDIA, siteMediaSchema, type SiteMedia } from "@/lib/media/resolve";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Admin photo choices for the public site. Never throws: falls back to the bundled defaults. */
export const getSiteMedia = cache(async (): Promise<SiteMedia> => {
  if (!isSupabaseConfigured()) return EMPTY_MEDIA;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_site_media");
    if (error) {
      console.error("get_site_media failed:", error.message);
      return EMPTY_MEDIA;
    }
    const parsed = siteMediaSchema.safeParse(data);
    return parsed.success ? parsed.data : EMPTY_MEDIA;
  } catch (error) {
    console.error("get_site_media failed:", error);
    return EMPTY_MEDIA;
  }
});
