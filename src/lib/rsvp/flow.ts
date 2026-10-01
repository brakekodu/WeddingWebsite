/**
 * Pure RSVP flow logic shared by the guest UI and its tests.
 *
 * Flow: welcome -> attendance (per person) -> events (per person/event, only
 * when someone attending has more than one RSVP event) -> meals (when needed)
 * -> dietary (when anyone attends) -> review -> submit -> confirmation.
 *
 * The database re-validates everything; this module exists so the guest gets
 * clear feedback before submitting and so the payload is always well formed.
 */
import type { InvitationEvent, InvitationGuest, InvitationView } from "@/lib/rsvp/view";

export type Answer = "attending" | "declined";
export type PairKey = `${string}:${string}`;

export const pairKey = (guestId: string, eventId: string): PairKey => `${guestId}:${eventId}`;

export interface RsvpPair {
  key: PairKey;
  guest: InvitationGuest;
  event: InvitationEvent;
}

export interface RsvpDraft {
  /** Step "attendance": will this person join us at all? */
  guestAttendance: Record<string, Answer | undefined>;
  /** Step "events": per-event answers for people who are attending. */
  eventAttendance: Record<PairKey, Answer | undefined>;
  /** Selected meal option id per (guest, event). */
  meals: Record<PairKey, string | undefined>;
  /** Person-level dietary restrictions. */
  dietary: Record<string, string>;
}

export type RsvpStep = "welcome" | "attendance" | "events" | "meals" | "dietary" | "review";

export type RsvpSubmission = {
  responses: { guest_id: string; event_id: string; status: Answer; meal_option_id: string | null }[];
  dietary: { guest_id: string; dietary_restrictions: string | null }[];
};

/** Every (guest, event) pair on this invitation that needs an answer, in display order. */
export function rsvpPairs(view: InvitationView): RsvpPair[] {
  const pairs: RsvpPair[] = [];
  for (const event of view.events) {
    if (!event.rsvp_required) continue;
    for (const guest of view.guests) {
      if (event.guest_ids.includes(guest.id)) {
        pairs.push({ key: pairKey(guest.id, event.id), guest, event });
      }
    }
  }
  return pairs;
}

/** Guests who have at least one event requiring an answer. */
export function guestsNeedingAnswers(view: InvitationView): InvitationGuest[] {
  const ids = new Set(rsvpPairs(view).map((p) => p.guest.id));
  return view.guests.filter((g) => ids.has(g.id));
}

/** Pre-fills the draft from saved responses so returning guests can edit. */
export function initialDraft(view: InvitationView): RsvpDraft {
  const draft: RsvpDraft = { guestAttendance: {}, eventAttendance: {}, meals: {}, dietary: {} };
  const activeMeals = new Set(view.events.flatMap((e) => e.meal_options.map((m) => m.id)));

  for (const r of view.responses) {
    const key = pairKey(r.guest_id, r.event_id);
    if (r.status !== "pending") draft.eventAttendance[key] = r.status;
    if (r.meal_option_id && activeMeals.has(r.meal_option_id)) draft.meals[key] = r.meal_option_id;
  }

  for (const guest of guestsNeedingAnswers(view)) {
    const answers = rsvpPairs(view)
      .filter((p) => p.guest.id === guest.id)
      .map((p) => draft.eventAttendance[p.key]);
    if (answers.some((a) => a === "attending")) draft.guestAttendance[guest.id] = "attending";
    else if (answers.length > 0 && answers.every((a) => a === "declined")) {
      draft.guestAttendance[guest.id] = "declined";
    }
  }

  for (const guest of view.guests) draft.dietary[guest.id] = guest.dietary_restrictions ?? "";
  return draft;
}

/** The final answer for a pair, combining the person-level and event-level answers. */
export function effectiveAnswer(draft: RsvpDraft, pair: RsvpPair): Answer | undefined {
  const person = draft.guestAttendance[pair.guest.id];
  if (person !== "attending") return person;
  return draft.eventAttendance[pair.key] ?? "attending";
}

export function isGuestAttendingAny(view: InvitationView, draft: RsvpDraft, guestId: string): boolean {
  return rsvpPairs(view).some((p) => p.guest.id === guestId && effectiveAnswer(draft, p) === "attending");
}

/** Pairs where the guest is attending an event that requires a meal choice. */
export function mealPairs(view: InvitationView, draft: RsvpDraft): RsvpPair[] {
  return rsvpPairs(view).filter((p) => p.event.meal_selection_required && effectiveAnswer(draft, p) === "attending");
}

export function stepsFor(view: InvitationView, draft: RsvpDraft): RsvpStep[] {
  const steps: RsvpStep[] = ["welcome", "attendance"];
  const pairs = rsvpPairs(view);
  const attendingGuests = guestsNeedingAnswers(view).filter((g) => draft.guestAttendance[g.id] === "attending");
  if (attendingGuests.some((g) => pairs.filter((p) => p.guest.id === g.id).length > 1)) {
    steps.push("events");
  }
  if (mealPairs(view, draft).length > 0) steps.push("meals");
  if (attendingGuests.length > 0) steps.push("dietary");
  steps.push("review");
  return steps;
}

/** Returns a guest-facing problem with the given step, or null when it is complete. */
export function stepProblem(view: InvitationView, draft: RsvpDraft, step: RsvpStep): string | null {
  if (step === "attendance") {
    const missing = guestsNeedingAnswers(view).filter((g) => !draft.guestAttendance[g.id]);
    if (missing.length > 0) return "Please let us know for each person whether they can join us.";
  }
  if (step === "meals") {
    const missing = mealPairs(view, draft).filter((p) => {
      const meal = draft.meals[p.key];
      return !meal || !p.event.meal_options.some((m) => m.id === meal);
    });
    if (missing.length > 0) return "Please choose a meal for each person attending.";
  }
  if (step === "dietary") {
    if (Object.values(draft.dietary).some((d) => d.length > 500)) {
      return "Please keep dietary notes under 500 characters.";
    }
  }
  return null;
}

export function buildSubmission(
  view: InvitationView,
  draft: RsvpDraft,
): { ok: true; submission: RsvpSubmission } | { ok: false; error: string } {
  for (const step of ["attendance", "meals", "dietary"] as const) {
    const problem = stepProblem(view, draft, step);
    if (problem) return { ok: false, error: problem };
  }

  const responses = rsvpPairs(view).map((pair) => {
    const status = effectiveAnswer(draft, pair) as Answer;
    const needsMeal = pair.event.meal_selection_required && status === "attending";
    return {
      guest_id: pair.guest.id,
      event_id: pair.event.id,
      status,
      meal_option_id: needsMeal ? (draft.meals[pair.key] ?? null) : null,
    };
  });

  // Only attending guests' dietary notes are sent, so declining never wipes them.
  const dietary = view.guests
    .filter((g) => isGuestAttendingAny(view, draft, g.id))
    .map((g) => ({ guest_id: g.id, dietary_restrictions: draft.dietary[g.id]?.trim() || null }));

  return { ok: true, submission: { responses, dietary } };
}

/** True once every required pair on the invitation has a saved answer. */
export function hasCompleteResponse(view: InvitationView): boolean {
  const pairs = rsvpPairs(view);
  if (pairs.length === 0) return false;
  const answered = new Set(
    view.responses.filter((r) => r.status !== "pending").map((r) => pairKey(r.guest_id, r.event_id)),
  );
  return pairs.every((p) => answered.has(p.key));
}
