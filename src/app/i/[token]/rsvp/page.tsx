import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/content/site";
import { getAdmin } from "@/lib/auth/admin";
import { fetchInvitationView } from "@/lib/invitations/server";
import { hasCompleteResponse, invitationNames } from "@/lib/rsvp/flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RsvpFlow } from "./rsvp-flow";

export const metadata: Metadata = { title: "RSVP", robots: { index: false, follow: false } };

/** The RSVP flow (screens 04–09, desktop 19). Editing re-enters at Review. */
export default async function RsvpPage(props: PageProps<"/i/[token]/rsvp">) {
  const { token } = await props.params;
  const { step } = await props.searchParams;
  const view = await fetchInvitationView(await createSupabaseServerClient(), token);
  if (!view || view.guests.length === 0) notFound();

  // Admins may record RSVPs after the deadline (e.g. a guest who phoned in).
  const canEdit = view.rsvp_open || Boolean(await getAdmin());
  const startAtReview = step === "review" && hasCompleteResponse(view);

  return (
    <RsvpFlow
      token={token}
      initialView={view}
      names={invitationNames(view)}
      monogram={site.couple.monogram}
      contactEmail={site.contactEmail}
      canEdit={canEdit}
      startAtReview={startAtReview}
    />
  );
}
