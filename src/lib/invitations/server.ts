/**
 * Server-side invitation operations shared by guest pages and admin actions.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isInvitationToken } from "@/lib/invitations/credentials";
import { validateInvitationQr, type QrValidationResult } from "@/lib/invitations/validation";
import { invitationViewSchema, type InvitationView } from "@/lib/rsvp/view";
import type { Database, Json } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Resolves a token through the public RPC, exactly as a guest's browser would.
 * When called with a signed-in admin's client, the access is not logged.
 */
export async function fetchInvitationView(supabase: Client, token: string): Promise<InvitationView | null> {
  if (!isInvitationToken(token)) return null;
  const { data, error } = await supabase.rpc("get_invitation", { p_token: token });
  if (error) throw new Error(`get_invitation failed: ${error.message}`);
  if (data === null) return null;
  return invitationViewSchema.parse(data);
}

/** Runs QR validation for one invitation and optionally stores the result. */
export async function runQrValidation(
  supabase: Client,
  invitationId: string,
  baseUrl: string,
  options: { persist: boolean },
): Promise<QrValidationResult> {
  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("id, token, invitation_guests(guest_id)")
    .eq("id", invitationId)
    .single();
  if (error || !invitation) throw new Error(`Invitation not found: ${error?.message ?? invitationId}`);

  const result = await validateInvitationQr({
    invitation: {
      id: invitation.id,
      token: invitation.token,
      guestIds: invitation.invitation_guests.map((g) => g.guest_id),
    },
    baseUrl,
    findInvitationIdByToken: async (token) => {
      const { data } = await supabase.from("invitations").select("id").eq("token", token).maybeSingle();
      return data?.id ?? null;
    },
    resolvePublicGuestIds: async (token) => {
      const view = await fetchInvitationView(supabase, token);
      return view ? view.guests.map((g) => g.id) : null;
    },
  });

  if (options.persist) {
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        qr_validation_status: result.status,
        validated_at: result.checkedAt,
        validated_url: result.expectedUrl,
        validation_details: result as unknown as Json,
      })
      .eq("id", invitationId);
    if (updateError) throw new Error(`Saving validation failed: ${updateError.message}`);
  }

  return result;
}
