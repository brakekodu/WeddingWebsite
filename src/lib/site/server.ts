/**
 * Server-side data for the public site and the "Viewing as" experience.
 */
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { isInvitationToken } from "@/lib/invitations/credentials";
import { fetchInvitationView } from "@/lib/invitations/server";
import { publicSiteSchema, type InvitationView, type PublicSite } from "@/lib/rsvp/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Remembers the visitor's invitation after they open /i/{token}, so public
 * pages can show "Viewing as …" and the personal schedule. Set in src/proxy.ts.
 * It holds the same bearer token as the link the guest already has.
 */
export const INVITE_COOKIE = "bw_invite";

const EMPTY_SITE: PublicSite = { events: [], rsvp_deadline: null };

/** Public events (never invite-only or draft) and the RSVP deadline. Never throws. */
export const getPublicSite = cache(async (): Promise<PublicSite> => {
  if (!isSupabaseConfigured()) return EMPTY_SITE;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_public_site");
    if (error) {
      console.error("get_public_site failed:", error.message);
      return EMPTY_SITE;
    }
    return publicSiteSchema.parse(data);
  } catch (error) {
    console.error("get_public_site failed:", error);
    return EMPTY_SITE;
  }
});

export interface Viewer {
  token: string;
  view: InvitationView;
}

/** The invitation remembered on this device, if it is still valid. Never throws. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(INVITE_COOKIE)?.value;
  if (!token || !isInvitationToken(token) || !isSupabaseConfigured()) return null;
  try {
    const view = await fetchInvitationView(await createSupabaseServerClient(), token);
    return view && view.guests.length > 0 ? { token, view } : null;
  } catch {
    return null;
  }
});
