import { getAdmin } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { formatRsvpCode } from "@/lib/invitations/credentials";

/** One row per (guest, assigned event) for guests on active invitations. Admin only. */
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Not authorized", { status: 401 });
  const { supabase } = admin;

  const [guests, events, assignments, rsvps, meals, links] = await Promise.all([
    supabase.from("guests").select("id, first_name, last_name, dietary_restrictions, households(display_name)"),
    supabase.from("events").select("id, name, rsvp_required").order("display_order"),
    supabase.from("guest_events").select("guest_id, event_id"),
    supabase.from("rsvps").select("guest_id, event_id, status, updated_at"),
    supabase.from("meal_selections").select("guest_id, event_id, meal_options(name)"),
    supabase.from("invitation_guests").select("guest_id, invitations(rsvp_code, status)"),
  ]);
  const failed = [guests, events, assignments, rsvps, meals, links].find((r) => r.error);
  if (failed?.error) return new Response("Export failed", { status: 500 });

  const guestById = new Map(guests.data!.map((g) => [g.id, g]));
  const eventById = new Map(events.data!.map((e) => [e.id, e]));
  const rsvpByPair = new Map(rsvps.data!.map((r) => [`${r.guest_id}:${r.event_id}`, r]));
  const mealByPair = new Map(meals.data!.map((m) => [`${m.guest_id}:${m.event_id}`, m.meal_options?.name]));
  const codeByGuest = new Map<string, string>();
  for (const l of links.data!) {
    if (l.invitations && l.invitations.status !== "void")
      codeByGuest.set(l.guest_id, formatRsvpCode(l.invitations.rsvp_code));
  }

  const rows: unknown[][] = [
    [
      "Household",
      "First name",
      "Last name",
      "Event",
      "RSVP",
      "Meal",
      "Dietary restrictions",
      "RSVP code",
      "Last updated",
    ],
  ];
  for (const a of assignments.data!) {
    const guest = guestById.get(a.guest_id);
    const event = eventById.get(a.event_id);
    if (!guest || !event || !codeByGuest.has(a.guest_id)) continue;
    const rsvp = rsvpByPair.get(`${a.guest_id}:${a.event_id}`);
    rows.push([
      guest.households?.display_name ?? "",
      guest.first_name,
      guest.last_name ?? "",
      event.name,
      event.rsvp_required ? (rsvp?.status ?? "pending") : "no rsvp needed",
      mealByPair.get(`${a.guest_id}:${a.event_id}`) ?? "",
      guest.dietary_restrictions ?? "",
      codeByGuest.get(a.guest_id),
      rsvp?.updated_at ?? "",
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rsvps-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
