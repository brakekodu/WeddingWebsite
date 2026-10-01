import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Everything the admin invitation detail and print pages need, in one place. */
export async function loadInvitationDetail(supabase: Client, invitationId: string) {
  const { data: invitation } = await supabase
    .from("invitations")
    .select("*, households(id, display_name)")
    .eq("id", invitationId)
    .maybeSingle();
  if (!invitation) return null;

  const { data: links } = await supabase
    .from("invitation_guests")
    .select("guest_id, display_order, guests(id, first_name, last_name, display_name, household_id)")
    .eq("invitation_id", invitationId)
    .order("display_order");
  const guests = (links ?? []).flatMap((l) => (l.guests ? [l.guests] : []));
  const guestIds = guests.map((g) => g.id);

  const [events, assignments, rsvps, meals, activity, otherInvitations] = await Promise.all([
    supabase.from("events").select("id, name, rsvp_required, meal_selection_required").order("display_order"),
    guestIds.length
      ? supabase.from("guest_events").select("guest_id, event_id").in("guest_id", guestIds)
      : Promise.resolve({ data: [] as { guest_id: string; event_id: string }[] }),
    guestIds.length
      ? supabase.from("rsvps").select("guest_id, event_id, status, updated_at").in("guest_id", guestIds)
      : Promise.resolve({ data: [] as { guest_id: string; event_id: string; status: string; updated_at: string }[] }),
    guestIds.length
      ? supabase.from("meal_selections").select("guest_id, event_id, meal_options(name)").in("guest_id", guestIds)
      : Promise.resolve({
          data: [] as { guest_id: string; event_id: string; meal_options: { name: string } | null }[],
        }),
    supabase
      .from("rsvp_activity")
      .select("id, activity_type, actor, occurred_at")
      .eq("invitation_id", invitationId)
      .order("occurred_at", { ascending: false })
      .limit(20),
    guestIds.length
      ? supabase
          .from("invitation_guests")
          .select("guest_id, invitation_id, invitations(status)")
          .in("guest_id", guestIds)
          .neq("invitation_id", invitationId)
      : Promise.resolve({
          data: [] as { guest_id: string; invitation_id: string; invitations: { status: string } | null }[],
        }),
  ]);

  return {
    invitation,
    guests,
    events: events.data ?? [],
    assignments: assignments.data ?? [],
    rsvps: rsvps.data ?? [],
    meals: meals.data ?? [],
    activity: activity.data ?? [],
    guestsOnOtherInvitations: new Set(
      (otherInvitations.data ?? []).filter((o) => o.invitations?.status !== "void").map((o) => o.guest_id),
    ),
  };
}

export type InvitationDetail = NonNullable<Awaited<ReturnType<typeof loadInvitationDetail>>>;

/**
 * Events visible on this invitation are the union of its guests' events.
 * If guests have different assignments, some guest will see an event they
 * are not personally invited to. Returns those events for a warning.
 */
export function sharedVisibilityWarnings(detail: InvitationDetail): { event: string; notInvited: string[] }[] {
  const byGuest = new Map(detail.guests.map((g) => [g.id, new Set<string>()]));
  for (const a of detail.assignments) byGuest.get(a.guest_id)?.add(a.event_id);
  const union = new Set(detail.assignments.map((a) => a.event_id));
  return detail.events
    .filter((e) => union.has(e.id))
    .map((e) => ({
      event: e.name,
      notInvited: detail.guests.filter((g) => !byGuest.get(g.id)?.has(e.id)).map((g) => g.first_name),
    }))
    .filter((w) => w.notInvited.length > 0);
}
