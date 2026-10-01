import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchInvitationView } from "@/lib/invitations/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RsvpExperience } from "./rsvp-experience";

export const metadata: Metadata = {
  title: "Your invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Personalized invitation. The token in the URL is a bearer credential: it is
 * resolved only through the public get_invitation() RPC, which returns this
 * invitation's guests and assigned events and nothing else.
 */
export default async function InvitationPage(props: PageProps<"/i/[token]">) {
  const { token } = await props.params;
  const supabase = await createSupabaseServerClient();
  const view = await fetchInvitationView(supabase, token);
  if (!view || view.guests.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 sm:py-20">
      <RsvpExperience token={token} initialView={view} />
    </main>
  );
}
