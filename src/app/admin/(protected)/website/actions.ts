"use server";

import type { SiteSection } from "@/content/site";
import { runAdminAction, throwIfDbError, UserFacingError } from "@/lib/admin/actions";
import type { ActionState } from "@/lib/admin/action-state";
import { getSectionSpec, parseSection } from "@/lib/site/content";
import type { Json } from "@/lib/supabase/database.types";

function sectionKey(section: unknown): SiteSection {
  const spec = typeof section === "string" ? getSectionSpec(section) : undefined;
  if (!spec) throw new UserFacingError("Unknown section.");
  return spec.key;
}

/** Saves one section of website wording. Everything is validated here; the browser is not trusted. */
export async function saveSiteSection(section: unknown, value: unknown): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const key = sectionKey(section);
    const parsed = parseSection(key, value);
    if (!parsed.ok) throw new UserFacingError(parsed.message);
    const { error } = await supabase.rpc("save_site_content_section", {
      p_section: key,
      p_value: parsed.value as unknown as Json,
    });
    throwIfDbError(error, "This section");
    return "Saved! It's live on the website.";
  });
}

/** Puts one section back to the original wording from the code. */
export async function resetSiteSection(section: unknown): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const key = sectionKey(section);
    const { error } = await supabase.rpc("save_site_content_section", { p_section: key, p_value: null });
    throwIfDbError(error, "This section");
    return "Back to the original wording.";
  });
}
