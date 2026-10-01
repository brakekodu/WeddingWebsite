"use server";

import { z } from "zod";
import { isInvitationToken } from "@/lib/invitations/credentials";
import { rsvpErrorMessage } from "@/lib/rsvp/errors";
import { submitResultSchema, type InvitationView } from "@/lib/rsvp/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Shape check only. The database validates every guest, event, and meal
// against the invitation, so this is not the security boundary.
const submissionSchema = z.object({
  responses: z
    .array(
      z.object({
        guest_id: z.string().max(64),
        event_id: z.string().max(64),
        status: z.enum(["attending", "declined"]),
        meal_option_id: z.string().max(64).nullable(),
      }),
    )
    .max(1000),
  dietary: z
    .array(
      z.object({
        guest_id: z.string().max(64),
        dietary_restrictions: z.string().max(500).nullable(),
      }),
    )
    .max(100),
});

export type SubmitRsvpResult =
  { ok: true; result: "rsvp_completed" | "rsvp_updated"; view: InvitationView } | { ok: false; error: string };

export async function submitRsvp(token: string, submission: unknown): Promise<SubmitRsvpResult> {
  if (!isInvitationToken(token)) return { ok: false, error: rsvpErrorMessage("invitation_not_found") };
  const parsed = submissionSchema.safeParse(submission);
  if (!parsed.success) return { ok: false, error: rsvpErrorMessage("invalid_payload") };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_rsvp", { p_token: token, p_payload: parsed.data });
  if (error) {
    if (!error.message.match(/^[a-z_]+$/)) console.error("submit_rsvp failed:", error);
    return { ok: false, error: rsvpErrorMessage(error.message) };
  }

  const result = submitResultSchema.safeParse(data);
  if (!result.success) {
    console.error("submit_rsvp returned an unexpected shape:", result.error);
    return { ok: false, error: rsvpErrorMessage(null) };
  }
  return { ok: true, result: result.data.result, view: result.data.invitation };
}

/** Operational signal that the guest began the RSVP flow. Best-effort. */
export async function recordRsvpStarted(token: string): Promise<void> {
  if (!isInvitationToken(token)) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_rsvp_started", { p_token: token });
  if (error) console.error("record_rsvp_started failed:", error.message);
}
