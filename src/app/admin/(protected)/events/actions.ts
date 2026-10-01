"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import {
  assertId,
  formBool,
  formIds,
  formInt,
  formLocalDateTime,
  formOptional,
  formRequired,
  runAdminAction,
  throwIfDbError,
  UserFacingError,
} from "@/lib/admin/actions";

function eventFields(fd: FormData) {
  const rsvpRequired = formBool(fd, "rsvp_required");
  const mealRequired = formBool(fd, "meal_selection_required");
  if (mealRequired && !rsvpRequired) {
    throw new UserFacingError("Meal selection requires RSVP to be enabled for this event.");
  }
  const startsAt = formLocalDateTime(fd, "starts_at");
  const endsAt = formLocalDateTime(fd, "ends_at");
  if (startsAt && endsAt && endsAt < startsAt) throw new UserFacingError("The end time must be after the start time.");
  const visibility = fd.get("visibility") === "public" ? "public" : "invited_only";
  return {
    name: formRequired(fd, "name", "Event name", 120),
    description: formOptional(fd, "description"),
    starts_at: startsAt,
    ends_at: endsAt,
    time_zone: formOptional(fd, "time_zone"),
    location_name: formOptional(fd, "location_name"),
    location_address: formOptional(fd, "location_address"),
    rsvp_required: rsvpRequired,
    meal_selection_required: mealRequired,
    visibility,
    display_order: formInt(fd, "display_order"),
  } as const;
}

export async function createEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | undefined;
  const state = await runAdminAction(async ({ supabase }) => {
    const { data, error } = await supabase.from("events").insert(eventFields(fd)).select("id").single();
    throwIfDbError(error, "The event");
    id = data!.id;
  });
  if (state?.ok && id) redirect(`/admin/events/${id}`);
  return state;
}

export async function updateEvent(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("events").update(eventFields(fd)).eq("id", assertId(eventId, "event"));
    throwIfDbError(error, "The event");
    return "Event saved.";
  });
}

export async function deleteEvent(eventId: string, _prev: ActionState): Promise<ActionState> {
  const state = await runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("events").delete().eq("id", assertId(eventId, "event"));
    throwIfDbError(error, "Deleting the event");
  });
  if (state?.ok) redirect("/admin/events");
  return state;
}

export async function addMealOption(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("meal_options").insert({
      event_id: assertId(eventId, "event"),
      name: formRequired(fd, "name", "Meal name", 120),
      description: formOptional(fd, "description"),
      display_order: formInt(fd, "display_order"),
    });
    throwIfDbError(error, "The meal option");
    return "Meal option added.";
  });
}

export async function setMealOptionActive(
  mealOptionId: string,
  isActive: boolean,
  _prev: ActionState,
): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase
      .from("meal_options")
      .update({ is_active: isActive })
      .eq("id", assertId(mealOptionId, "meal option"));
    throwIfDbError(error, "The meal option");
    return isActive ? "Meal option offered again." : "Meal option hidden from guests.";
  });
}

export async function deleteMealOption(mealOptionId: string, _prev: ActionState): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("meal_options").delete().eq("id", assertId(mealOptionId, "meal option"));
    if (error?.code === "23503") {
      throw new UserFacingError("Guests have chosen this meal. Hide it instead of deleting it.");
    }
    throwIfDbError(error, "Deleting the meal option");
    return "Meal option deleted.";
  });
}

/**
 * Replaces the set of guests invited to this event with the checked guests.
 * Removing a guest also removes their RSVP for this event.
 */
export async function setEventGuests(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const id = assertId(eventId, "event");
    const selected = new Set(formIds(fd, "guest_id"));
    const { data: current, error } = await supabase.from("guest_events").select("guest_id").eq("event_id", id);
    throwIfDbError(error, "Loading assignments");
    const existing = new Set(current!.map((r) => r.guest_id));

    const toRemove = [...existing].filter((g) => !selected.has(g));
    const toAdd = [...selected].filter((g) => !existing.has(g));
    if (toRemove.length > 0) {
      const { error: delError } = await supabase
        .from("guest_events")
        .delete()
        .eq("event_id", id)
        .in("guest_id", toRemove);
      throwIfDbError(delError, "Removing guests");
    }
    if (toAdd.length > 0) {
      const { error: insError } = await supabase
        .from("guest_events")
        .insert(toAdd.map((guest_id) => ({ guest_id, event_id: id })));
      throwIfDbError(insError, "Adding guests");
    }
    return `Guest list saved (${toAdd.length} added, ${toRemove.length} removed).`;
  });
}
