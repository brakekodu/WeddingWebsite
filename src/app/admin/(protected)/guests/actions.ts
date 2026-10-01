"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import {
  assertId,
  formBool,
  formIds,
  formOptional,
  formRequired,
  runAdminAction,
  throwIfDbError,
  UserFacingError,
} from "@/lib/admin/actions";

function guestFields(fd: FormData) {
  const householdId = formOptional(fd, "household_id");
  const plusOneOf = formOptional(fd, "plus_one_of");
  const dietary = formOptional(fd, "dietary_restrictions");
  if (dietary && dietary.length > 500) throw new UserFacingError("Dietary notes must be 500 characters or fewer.");
  return {
    first_name: formRequired(fd, "first_name", "First name", 100),
    last_name: formOptional(fd, "last_name"),
    display_name: formOptional(fd, "display_name"),
    email: formOptional(fd, "email"),
    phone: formOptional(fd, "phone"),
    household_id: householdId ? assertId(householdId, "household") : null,
    plus_one_allowed: formBool(fd, "plus_one_allowed"),
    plus_one_of: plusOneOf ? assertId(plusOneOf, "guest") : null,
    dietary_restrictions: dietary,
    notes: formOptional(fd, "notes"),
  };
}

export async function createGuest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("guests").insert(guestFields(fd));
    throwIfDbError(error, "The guest");
    return "Guest added.";
  });
}

export async function updateGuest(guestId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const fields = guestFields(fd);
    if (fields.plus_one_of === guestId) throw new UserFacingError("A guest cannot be their own plus-one.");
    const { error } = await supabase.from("guests").update(fields).eq("id", assertId(guestId, "guest"));
    throwIfDbError(error, "The guest");
    return "Guest saved.";
  });
}

export async function deleteGuest(guestId: string, _prev: ActionState): Promise<ActionState> {
  const state = await runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("guests").delete().eq("id", assertId(guestId, "guest"));
    throwIfDbError(error, "Deleting the guest");
  });
  if (state?.ok) redirect("/admin/guests");
  return state;
}

/**
 * Replaces the guest's event assignments with the checked events.
 * Removing an assignment also removes that guest's RSVP for the event.
 */
export async function setGuestEvents(guestId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const id = assertId(guestId, "guest");
    const selected = new Set(formIds(fd, "event_id"));
    const { data: current, error } = await supabase.from("guest_events").select("event_id").eq("guest_id", id);
    throwIfDbError(error, "Loading assignments");
    const existing = new Set(current!.map((r) => r.event_id));

    const toRemove = [...existing].filter((e) => !selected.has(e));
    const toAdd = [...selected].filter((e) => !existing.has(e));
    if (toRemove.length > 0) {
      const { error: delError } = await supabase
        .from("guest_events")
        .delete()
        .eq("guest_id", id)
        .in("event_id", toRemove);
      throwIfDbError(delError, "Removing event assignments");
    }
    if (toAdd.length > 0) {
      const { error: insError } = await supabase
        .from("guest_events")
        .insert(toAdd.map((event_id) => ({ guest_id: id, event_id })));
      throwIfDbError(insError, "Adding event assignments");
    }
    return `Events saved (${toAdd.length} added, ${toRemove.length} removed).`;
  });
}
