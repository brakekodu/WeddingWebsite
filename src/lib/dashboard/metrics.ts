/**
 * Dashboard metrics, computed from plain rows so the definitions are explicit
 * and unit-tested. See docs/ADMIN-DASHBOARD.md for the definitions in prose.
 *
 * "Invited" means: on at least one invitation that is not void.
 */
import { fullName } from "@/lib/invitations/greeting";
import { effectiveValidationStatus } from "@/lib/invitations/validation";

export interface DashboardInput {
  baseUrl: string;
  householdsCount: number;
  invitations: {
    id: string;
    status: "draft" | "locked" | "void";
    token: string;
    qr_validation_status: "not_validated" | "passed" | "failed";
    validated_url: string | null;
  }[];
  invitationGuests: { invitation_id: string; guest_id: string }[];
  guests: { id: string; first_name: string; last_name: string | null; dietary_restrictions: string | null }[];
  events: { id: string; name: string; rsvp_required: boolean; meal_selection_required: boolean }[];
  guestEvents: { guest_id: string; event_id: string }[];
  rsvps: { guest_id: string; event_id: string; status: "pending" | "attending" | "declined" }[];
  mealSelections: { guest_id: string; event_id: string; meal_option_id: string }[];
  mealOptions: { id: string; event_id: string; name: string; is_active: boolean }[];
}

export interface EventMetrics {
  id: string;
  name: string;
  rsvpRequired: boolean;
  mealRequired: boolean;
  invited: number;
  attending: number;
  declined: number;
  pending: number;
  meals: { id: string; name: string; active: boolean; count: number }[];
  missingMeals: number;
}

export interface DashboardMetrics {
  totals: {
    guestsInvited: number;
    households: number;
    invitations: number;
    invitationsAwaitingResponse: number;
    responsesReceived: number;
    /** 0–100, of invitations that need a response. */
    responsePercent: number;
    attending: number;
    declined: number;
    outstanding: number;
    /** Invited guests whose events need no RSVP. */
    noRsvpNeeded: number;
    /** Guests not on any active invitation yet. */
    guestsWithoutInvitation: number;
  };
  events: EventMetrics[];
  missingMeals: { guestName: string; eventName: string }[];
  dietary: { guestName: string; restrictions: string }[];
  qr: { passed: number; failed: number; stale: number; notValidated: number };
}

const key = (guestId: string, eventId: string) => `${guestId}:${eventId}`;

export function computeDashboardMetrics(input: DashboardInput): DashboardMetrics {
  const activeInvitations = input.invitations.filter((i) => i.status !== "void");
  const activeInvitationIds = new Set(activeInvitations.map((i) => i.id));
  const guestById = new Map(input.guests.map((g) => [g.id, g]));
  const eventById = new Map(input.events.map((e) => [e.id, e]));
  const rsvpByPair = new Map(input.rsvps.map((r) => [key(r.guest_id, r.event_id), r.status]));
  const mealByPair = new Map(input.mealSelections.map((m) => [key(m.guest_id, m.event_id), m.meal_option_id]));

  const guestsByInvitation = new Map<string, string[]>();
  for (const ig of input.invitationGuests) {
    if (!activeInvitationIds.has(ig.invitation_id) || !guestById.has(ig.guest_id)) continue;
    guestsByInvitation.set(ig.invitation_id, [...(guestsByInvitation.get(ig.invitation_id) ?? []), ig.guest_id]);
  }
  const invitedGuestIds = new Set([...guestsByInvitation.values()].flat());

  // RSVP-required events per guest.
  const requiredEventsByGuest = new Map<string, string[]>();
  for (const ge of input.guestEvents) {
    if (!eventById.get(ge.event_id)?.rsvp_required) continue;
    requiredEventsByGuest.set(ge.guest_id, [...(requiredEventsByGuest.get(ge.guest_id) ?? []), ge.event_id]);
  }
  const answer = (guestId: string, eventId: string) => rsvpByPair.get(key(guestId, eventId)) ?? "pending";

  // Invitations
  let invitationsAwaitingResponse = 0;
  let responsesReceived = 0;
  for (const invitation of activeInvitations) {
    const pairs = (guestsByInvitation.get(invitation.id) ?? []).flatMap((g) =>
      (requiredEventsByGuest.get(g) ?? []).map((e) => [g, e] as const),
    );
    if (pairs.length === 0) continue;
    invitationsAwaitingResponse++;
    if (pairs.every(([g, e]) => answer(g, e) !== "pending")) responsesReceived++;
  }

  // Guests
  let attending = 0;
  let declined = 0;
  let outstanding = 0;
  let noRsvpNeeded = 0;
  const attendingGuestIds = new Set<string>();
  for (const guestId of invitedGuestIds) {
    const answers = (requiredEventsByGuest.get(guestId) ?? []).map((e) => answer(guestId, e));
    if (answers.length === 0) noRsvpNeeded++;
    else if (answers.every((a) => a === "pending")) outstanding++;
    else if (answers.some((a) => a === "attending")) {
      attending++;
      attendingGuestIds.add(guestId);
    } else declined++;
  }

  // Events
  const missingMeals: DashboardMetrics["missingMeals"] = [];
  const events: EventMetrics[] = input.events.map((event) => {
    const guestIds = input.guestEvents
      .filter((ge) => ge.event_id === event.id && invitedGuestIds.has(ge.guest_id))
      .map((ge) => ge.guest_id);
    const statuses = guestIds.map((g) => answer(g, event.id));
    const attendingIds = guestIds.filter((g) => answer(g, event.id) === "attending");
    const options = input.mealOptions.filter((m) => m.event_id === event.id);
    let missing = 0;
    if (event.meal_selection_required) {
      for (const g of attendingIds) {
        const meal = mealByPair.get(key(g, event.id));
        if (!meal || !options.some((o) => o.id === meal)) {
          missing++;
          missingMeals.push({ guestName: fullName(guestById.get(g)!), eventName: event.name });
        }
      }
    }
    return {
      id: event.id,
      name: event.name,
      rsvpRequired: event.rsvp_required,
      mealRequired: event.meal_selection_required,
      invited: guestIds.length,
      attending: attendingIds.length,
      declined: statuses.filter((s) => s === "declined").length,
      pending: event.rsvp_required ? statuses.filter((s) => s === "pending").length : 0,
      meals: options.map((o) => ({
        id: o.id,
        name: o.name,
        active: o.is_active,
        count: attendingIds.filter((g) => mealByPair.get(key(g, event.id)) === o.id).length,
      })),
      missingMeals: missing,
    };
  });

  const dietary = [...attendingGuestIds]
    .map((id) => guestById.get(id)!)
    .filter((g) => g.dietary_restrictions?.trim())
    .map((g) => ({ guestName: fullName(g), restrictions: g.dietary_restrictions!.trim() }))
    .sort((a, b) => a.guestName.localeCompare(b.guestName));

  const qr = { passed: 0, failed: 0, stale: 0, notValidated: 0 };
  for (const invitation of activeInvitations) {
    const status = effectiveValidationStatus(invitation, input.baseUrl);
    if (status === "passed") qr.passed++;
    else if (status === "failed") qr.failed++;
    else if (status === "stale") qr.stale++;
    else qr.notValidated++;
  }

  const allGuestIds = input.guests.map((g) => g.id);
  return {
    totals: {
      guestsInvited: invitedGuestIds.size,
      households: input.householdsCount,
      invitations: activeInvitations.length,
      invitationsAwaitingResponse,
      responsesReceived,
      responsePercent:
        invitationsAwaitingResponse === 0 ? 0 : Math.round((responsesReceived / invitationsAwaitingResponse) * 100),
      attending,
      declined,
      outstanding,
      noRsvpNeeded,
      guestsWithoutInvitation: allGuestIds.filter((id) => !invitedGuestIds.has(id)).length,
    },
    events,
    missingMeals,
    dietary,
    qr,
  };
}
