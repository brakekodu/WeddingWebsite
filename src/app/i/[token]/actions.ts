"use server";

import { z } from "zod";
import { isInvitationToken } from "@/lib/invitations/credentials";
import { DIETARY_TAGS } from "@/lib/rsvp/dietary";
import { rsvpErrorMessage } from "@/lib/rsvp/errors";
import { submitResultSchema, type InvitationView } from "@/lib/rsvp/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const tagKeys = DIETARY_TAGS.map((t) => t.key) as [string, ...string[]];

// Shape check only. The database validates every guest, event, meal, and
// name against the invitation, so this is not the security boundary.
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
        dietary_tags: z.array(z.enum(tagKeys)).max(tagKeys.length),
      }),
    )
    .max(100),
  plus_ones: z
    .array(
      z.object({
        guest_id: z.string().max(64),
        first_name: z.string().min(1).max(100),
        last_name: z.string().max(100).nullable(),
      }),
    )
    .max(100),
  contact_email: z.string().max(254).nullable(),
  message: z.string().max(1000).nullable(),
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
    if (!/^[a-z_]+$/.test(error.message)) console.error("submit_rsvp failed:", error);
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
