"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import {
  assertId,
  formBool,
  formIds,
  formOptional,
  runAdminAction,
  throwIfDbError,
  UserFacingError,
} from "@/lib/admin/actions";
import type { AdminContext } from "@/lib/auth/admin";
import { getAppBaseUrl } from "@/lib/env";
import { runQrValidation } from "@/lib/invitations/server";
import { isProvisionalBaseUrl } from "@/lib/invitations/url";
import { effectiveValidationStatus, type QrValidationResult } from "@/lib/invitations/validation";

export async function createInvitation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let invitationId: string | undefined;
  const state = await runAdminAction(async ({ supabase }) => {
    const householdId = formOptional(fd, "household_id");
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        household_id: householdId ? assertId(householdId, "household") : null,
        label: formOptional(fd, "label"),
      })
      .select("id")
      .single();
    throwIfDbError(error, "The invitation");
    invitationId = data!.id;

    if (householdId && formBool(fd, "include_household_guests")) {
      const { data: members } = await supabase.from("guests").select("id").eq("household_id", householdId);
      if (members && members.length > 0) {
        const { error: linkError } = await supabase
          .from("invitation_guests")
          .insert(members.map((m, i) => ({ invitation_id: invitationId!, guest_id: m.id, display_order: i })));
        throwIfDbError(linkError, "Adding household guests");
      }
    }
  });
  if (state?.ok && invitationId) redirect(`/admin/invitations/${invitationId}`);
  return state;
}

export async function updateInvitation(invitationId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const householdId = formOptional(fd, "household_id");
    const { error } = await supabase
      .from("invitations")
      .update({
        label: formOptional(fd, "label"),
        household_id: householdId ? assertId(householdId, "household") : null,
        notes: formOptional(fd, "notes"),
      })
      .eq("id", assertId(invitationId, "invitation"));
    throwIfDbError(error, "The invitation");
    return "Invitation saved.";
  });
}

export async function addGuestsToInvitation(
  invitationId: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const id = assertId(invitationId, "invitation");
    const guestIds = formIds(fd, "guest_id");
    if (guestIds.length === 0) throw new UserFacingError("Choose at least one guest.");
    const { count } = await supabase
      .from("invitation_guests")
      .select("guest_id", { count: "exact", head: true })
      .eq("invitation_id", id);
    const { error } = await supabase
      .from("invitation_guests")
      .insert(guestIds.map((guest_id, i) => ({ invitation_id: id, guest_id, display_order: (count ?? 0) + i })));
    throwIfDbError(error, "Adding guests");
    return `${guestIds.length} guest(s) added. Re-validate the QR code before printing.`;
  });
}

export async function removeGuestFromInvitation(
  invitationId: string,
  guestId: string,
  _prev: ActionState,
): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase
      .from("invitation_guests")
      .delete()
      .eq("invitation_id", assertId(invitationId, "invitation"))
      .eq("guest_id", assertId(guestId, "guest"));
    throwIfDbError(error, "Removing the guest");
    return "Guest removed from this invitation.";
  });
}

export async function regenerateToken(invitationId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.rpc("regenerate_invitation_token", {
      p_invitation_id: assertId(invitationId, "invitation"),
    });
    throwIfDbError(error, "Regenerating the token");
    return "New link and RSVP code generated. The old link no longer works.";
  });
}

async function setStatus({ supabase }: AdminContext, invitationId: string, status: "draft" | "locked" | "void") {
  const { error } = await supabase
    .from("invitations")
    .update({ status })
    .eq("id", assertId(invitationId, "invitation"));
  throwIfDbError(error, "Updating the invitation");
}

export async function lockInvitation(invitationId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async (admin) => {
    await setStatus(admin, invitationId, "locked");
    return "Invitation locked. Its link and RSVP code can no longer change.";
  });
}

export async function voidInvitation(invitationId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async (admin) => {
    await setStatus(admin, invitationId, "void");
    return "Invitation voided. Its link and code no longer work.";
  });
}

export async function restoreInvitation(invitationId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async (admin) => {
    const { data } = await admin.supabase.from("invitations").select("locked_at").eq("id", invitationId).single();
    await setStatus(admin, invitationId, data?.locked_at ? "locked" : "draft");
    return "Invitation restored.";
  });
}

/**
 * Runs every QR validation check. mode=test is a dry run for inspection;
 * mode=validate saves the result on the invitation.
 */
export async function checkQr(
  invitationId: string,
  _prev: ActionState<QrValidationResult>,
  fd: FormData,
): Promise<ActionState<QrValidationResult>> {
  const persist = fd.get("mode") === "validate";
  return runAdminAction<QrValidationResult>(async ({ supabase }) => {
    const result = await runQrValidation(supabase, assertId(invitationId, "invitation"), getAppBaseUrl(), { persist });
    const outcome = result.status === "passed" ? "passed" : "FAILED";
    return {
      message: persist ? `Validation ${outcome} and saved.` : `Test ${outcome} (not saved).`,
      data: result,
    };
  });
}

export async function validateAllInvitations(_prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const baseUrl = getAppBaseUrl();
    const { data: invitations, error } = await supabase.from("invitations").select("id").neq("status", "void");
    throwIfDbError(error, "Loading invitations");
    let passed = 0;
    let failed = 0;
    for (const inv of invitations ?? []) {
      const result = await runQrValidation(supabase, inv.id, baseUrl, { persist: true });
      if (result.status === "passed") passed++;
      else failed++;
    }
    return failed === 0
      ? `All ${passed} invitation(s) passed QR validation.`
      : `${passed} passed, ${failed} FAILED. Fix failures before printing.`;
  });
}

export async function recordProofPrinted(invitationId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const id = assertId(invitationId, "invitation");
    const { data } = await supabase.from("invitations").select("print_status").eq("id", id).single();
    if (data?.print_status === "printed") throw new UserFacingError("This invitation is already marked as printed.");
    const { error } = await supabase
      .from("invitations")
      .update({ print_status: "proof_printed", proof_printed_at: new Date().toISOString() })
      .eq("id", id);
    throwIfDbError(error, "Recording the proof");
    return "Proof print recorded.";
  });
}

/** Final print: requires the production domain, a lock, and a current passing validation. */
export async function markPrinted(invitationId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const id = assertId(invitationId, "invitation");
    const baseUrl = getAppBaseUrl();
    if (isProvisionalBaseUrl(baseUrl)) {
      throw new UserFacingError(
        `APP_BASE_URL (${baseUrl}) is not the production domain. Do not print final invitations yet.`,
      );
    }
    const { data: inv } = await supabase
      .from("invitations")
      .select("token, status, qr_validation_status, validated_url")
      .eq("id", id)
      .single();
    if (!inv) throw new UserFacingError("Invitation not found.");
    if (inv.status !== "locked") throw new UserFacingError("Lock the invitation before marking it printed.");
    if (effectiveValidationStatus(inv, baseUrl) !== "passed") {
      throw new UserFacingError("Validate the QR code against the current domain before marking it printed.");
    }
    const { error } = await supabase.from("invitations").update({ print_status: "printed" }).eq("id", id);
    throwIfDbError(error, "Marking printed");
    return "Marked as printed.";
  });
}
