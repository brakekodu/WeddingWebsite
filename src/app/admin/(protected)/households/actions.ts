"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import {
  assertId,
  formOptional,
  formRequired,
  runAdminAction,
  throwIfDbError,
  UserFacingError,
} from "@/lib/admin/actions";

function householdFields(fd: FormData) {
  return {
    display_name: formRequired(fd, "display_name", "Household name"),
    address_line1: formOptional(fd, "address_line1"),
    address_line2: formOptional(fd, "address_line2"),
    city: formOptional(fd, "city"),
    region: formOptional(fd, "region"),
    postal_code: formOptional(fd, "postal_code"),
    country: formOptional(fd, "country"),
    primary_email: formOptional(fd, "primary_email"),
    primary_phone: formOptional(fd, "primary_phone"),
    notes: formOptional(fd, "notes"),
  };
}

export async function createHousehold(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | undefined;
  const state = await runAdminAction(async ({ supabase }) => {
    const { data, error } = await supabase.from("households").insert(householdFields(fd)).select("id").single();
    throwIfDbError(error, "The household");
    id = data!.id;
  });
  if (state?.ok && id) redirect(`/admin/households/${id}`);
  return state;
}

export async function updateHousehold(householdId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase
      .from("households")
      .update(householdFields(fd))
      .eq("id", assertId(householdId, "household"));
    throwIfDbError(error, "The household");
    return "Household saved.";
  });
}

export async function deleteHousehold(householdId: string, _prev: ActionState): Promise<ActionState> {
  const state = await runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("households").delete().eq("id", assertId(householdId, "household"));
    if (error?.code === "23503") {
      throw new UserFacingError("Move or delete this household's guests before deleting it.");
    }
    throwIfDbError(error, "Deleting the household");
  });
  if (state?.ok) redirect("/admin/households");
  return state;
}

export async function addGuestToHousehold(householdId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("guests").insert({
      household_id: assertId(householdId, "household"),
      first_name: formRequired(fd, "first_name", "First name", 100),
      last_name: formOptional(fd, "last_name"),
      email: formOptional(fd, "email"),
    });
    throwIfDbError(error, "The guest");
    return "Guest added.";
  });
}

/** Creates an invitation covering every guest currently in the household. */
export async function createInvitationForHousehold(householdId: string, _prev: ActionState): Promise<ActionState> {
  let invitationId: string | undefined;
  const state = await runAdminAction(async ({ supabase }) => {
    const id = assertId(householdId, "household");
    const { data: household, error: hError } = await supabase
      .from("households")
      .select("display_name, guests(id)")
      .eq("id", id)
      .single();
    throwIfDbError(hError, "Loading the household");
    if (!household || household.guests.length === 0) {
      throw new UserFacingError("Add guests to this household first.");
    }

    const { data: invitation, error } = await supabase
      .from("invitations")
      .insert({ household_id: id, label: household.display_name })
      .select("id")
      .single();
    throwIfDbError(error, "The invitation");
    invitationId = invitation!.id;

    const { error: linkError } = await supabase
      .from("invitation_guests")
      .insert(household.guests.map((g, i) => ({ invitation_id: invitationId!, guest_id: g.id, display_order: i })));
    throwIfDbError(linkError, "Adding guests to the invitation");
  });
  if (state?.ok && invitationId) redirect(`/admin/invitations/${invitationId}`);
  return state;
}
