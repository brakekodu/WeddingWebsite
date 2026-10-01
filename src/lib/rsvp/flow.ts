/**
 * Pure RSVP flow logic shared by the guest UI and its tests.
 * Rules come from the design handoff (design/brake-wedding-handoff/README.md):
 *
 *   1 Attendance  per guest: Accept / Decline (plus-one: bringing + name)
 *   2 Events      only guests who accepted, only events each is invited to; Yes/No
 *   3 Meals*      only if someone attends an event that requires a meal
 *   4 Dietary     optional; chips + details per attending guest; note to the couple
 *   5 Review      every section with Edit; optional email; Submit
 *
 * Everyone declines → skip straight to Review. Nothing is saved until Submit.
 * The database re-validates everything; this module gives clear feedback first.
 */
import type { DietaryTag } from "@/lib/rsvp/dietary";
import type { InvitationEvent, InvitationGuest, InvitationView } from "@/lib/rsvp/view";

export type Answer = "attending" | "declined";
export type PairKey = `${string}:${string}`;
export type RsvpStep = "attendance" | "events" | "meals" | "dietary" | "review";

export const pairKey = (guestId: string, eventId: string): PairKey => `${guestId}:${eventId}`;

/** Placeholder first name for unnamed plus-ones (see docs/RSVP-FLOW.md). */
export const PLUS_ONE_PLACEHOLDER = "Guest";

export interface RsvpPair {
  key: PairKey;
  guest: InvitationGuest;
  event: InvitationEvent;
}

export interface RsvpDraft {
  /** Step 1. For a plus-one, "attending" means "bringing a guest". */
  attendance: Record<string, Answer | undefined>;
  plusOneNames: Record<string, { first: string; last: string }>;
  /** Step 2, per (guest, event). */
  events: Record<PairKey, Answer | undefined>;
  meals: Record<PairKey, string | undefined>;
  dietaryTags: Record<string, DietaryTag[]>;
  dietaryDetails: Record<string, string>;
  message: string;
  email: string;
}

export type RsvpSubmission = {
  responses: { guest_id: string; event_id: string; status: Answer; meal_option_id: string | null }[];
  dietary: { guest_id: string; dietary_restrictions: string | null; dietary_tags: DietaryTag[] }[];
  plus_ones: { guest_id: string; first_name: string; last_name: string | null }[];
  contact_email: string | null;
  message: string | null;
};

/** A problem the guest must fix, with the DOM id of the first offending field. */
export interface StepProblem {
  message: string;
  targetId?: string;
}

export const fieldId = {
  attendance: (guestId: string) => `rsvp-attendance-${guestId}`,
  plusOneName: (guestId: string) => `rsvp-plusone-${guestId}`,
  event: (key: PairKey) => `rsvp-event-${key.replace(":", "-")}`,
  meal: (key: PairKey) => `rsvp-meal-${key.replace(":", "-")}`,
};

export const STEP_TITLES: Record<RsvpStep, string> = {
  attendance: "Attendance",
  events: "Events",
  meals: "Dinner",
  dietary: "Dietary",
  review: "Review",
};

/** Every (guest, event) pair on this invitation that needs an answer, in display order. */
export function rsvpPairs(view: InvitationView): RsvpPair[] {
  const pairs: RsvpPair[] = [];
  for (const event of view.events) {
    if (!event.rsvp_required) continue;
    for (const guest of view.guests) {
      if (event.guest_ids.includes(guest.id)) pairs.push({ key: pairKey(guest.id, event.id), guest, event });
    }
  }
  return pairs;
}

/** Guests who have at least one event requiring an answer. */
export function guestsNeedingAnswers(view: InvitationView): InvitationGuest[] {
  const ids = new Set(rsvpPairs(view).map((p) => p.guest.id));
  return view.guests.filter((g) => ids.has(g.id));
}

export function isPlaceholderName(guest: InvitationGuest): boolean {
  return guest.first_name.trim().toLowerCase() === PLUS_ONE_PLACEHOLDER.toLowerCase() && !guest.last_name;
}

/** Final answer for a pair: declined if the person declined in step 1, else their step-2 answer. */
export function effectiveAnswer(draft: RsvpDraft, pair: RsvpPair): Answer | undefined {
  const person = draft.attendance[pair.guest.id];
  if (person === "declined") return "declined";
  if (person === undefined) return undefined;
  return draft.events[pair.key];
}

export function acceptedGuests(view: InvitationView, draft: RsvpDraft): InvitationGuest[] {
  return guestsNeedingAnswers(view).filter((g) => draft.attendance[g.id] === "attending");
}

export function isGuestAttendingAny(view: InvitationView, draft: RsvpDraft, guestId: string): boolean {
  return rsvpPairs(view).some((p) => p.guest.id === guestId && effectiveAnswer(draft, p) === "attending");
}

/** Pairs where the guest is attending an event that requires a meal choice. */
export function mealPairs(view: InvitationView, draft: RsvpDraft): RsvpPair[] {
  return rsvpPairs(view).filter((p) => p.event.meal_selection_required && effectiveAnswer(draft, p) === "attending");
}

export function stepsFor(view: InvitationView, draft: RsvpDraft): RsvpStep[] {
  const everyoneAnswered = guestsNeedingAnswers(view).every((g) => draft.attendance[g.id]);
  if (everyoneAnswered && acceptedGuests(view, draft).length === 0) return ["attendance", "review"];
  const steps: RsvpStep[] = ["attendance", "events"];
  if (mealPairs(view, draft).length > 0) steps.push("meals");
  steps.push("dietary", "review");
  return steps;
}

/** The name shown for a guest in the flow ("John", "Alex", or "John's guest"). */
export function guestLabel(guest: InvitationGuest, draft?: RsvpDraft): string {
  if (guest.is_plus_one) {
    const typed = draft?.plusOneNames[guest.id]?.first.trim();
    if (typed) return typed;
    if (!isPlaceholderName(guest)) return guest.display_name?.trim() || guest.first_name;
    return `${guest.plus_one_host ?? "Your"}'s guest`;
  }
  return guest.display_name?.trim() || guest.first_name;
}

export function stepProblem(view: InvitationView, draft: RsvpDraft, step: RsvpStep): StepProblem | null {
  if (step === "attendance") {
    for (const guest of guestsNeedingAnswers(view)) {
      const answer = draft.attendance[guest.id];
      if (!answer) {
        return {
          message: guest.is_plus_one
            ? `Please let us know whether ${guest.plus_one_host ?? "you're"} bringing a guest.`
            : `Please choose an answer for ${guestLabel(guest)}.`,
          targetId: fieldId.attendance(guest.id),
        };
      }
      if (guest.is_plus_one && answer === "attending" && !draft.plusOneNames[guest.id]?.first.trim()) {
        return { message: "Please add your guest's first name.", targetId: fieldId.plusOneName(guest.id) };
      }
    }
  }
  if (step === "events") {
    for (const pair of rsvpPairs(view)) {
      if (draft.attendance[pair.guest.id] === "attending" && !draft.events[pair.key]) {
        return {
          message: `Choose Yes or No for ${guestLabel(pair.guest, draft)} at the ${pair.event.name}.`,
          targetId: fieldId.event(pair.key),
        };
      }
    }
  }
  if (step === "meals") {
    for (const pair of mealPairs(view, draft)) {
      const meal = draft.meals[pair.key];
      if (!meal || !pair.event.meal_options.some((m) => m.id === meal)) {
        return {
          message: `Please choose a meal for ${guestLabel(pair.guest, draft)}.`,
          targetId: fieldId.meal(pair.key),
        };
      }
    }
  }
  if (step === "dietary") {
    if (Object.values(draft.dietaryDetails).some((d) => d.length > 500)) {
      return { message: "Please keep dietary details under 500 characters." };
    }
    if (draft.message.length > 1000) return { message: "Please keep your note under 1,000 characters." };
  }
  if (step === "review") {
    const email = draft.email.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { message: "Please check your email address." };
  }
  return null;
}

/** Pre-fills the draft from saved responses so returning guests can edit. */
export function initialDraft(view: InvitationView): RsvpDraft {
  const draft: RsvpDraft = {
    attendance: {},
    plusOneNames: {},
    events: {},
    meals: {},
    dietaryTags: {},
    dietaryDetails: {},
    message: view.guest_message ?? "",
    email: view.contact_email ?? "",
  };
  const activeMeals = new Set(view.events.flatMap((e) => e.meal_options.map((m) => m.id)));
  for (const r of view.responses) {
    const key = pairKey(r.guest_id, r.event_id);
    if (r.status !== "pending") draft.events[key] = r.status;
    if (r.meal_option_id && activeMeals.has(r.meal_option_id)) draft.meals[key] = r.meal_option_id;
  }
  const pairs = rsvpPairs(view);
  for (const guest of guestsNeedingAnswers(view)) {
    const answers = pairs.filter((p) => p.guest.id === guest.id).map((p) => draft.events[p.key]);
    if (answers.some((a) => a === "attending")) draft.attendance[guest.id] = "attending";
    else if (answers.length > 0 && answers.every((a) => a === "declined")) draft.attendance[guest.id] = "declined";
  }
  for (const guest of view.guests) {
    draft.dietaryTags[guest.id] = guest.dietary_tags as DietaryTag[];
    draft.dietaryDetails[guest.id] = guest.dietary_restrictions ?? "";
    if (guest.is_plus_one) {
      draft.plusOneNames[guest.id] = isPlaceholderName(guest)
        ? { first: "", last: "" }
        : { first: guest.first_name, last: guest.last_name ?? "" };
    }
  }
  return draft;
}

export function buildSubmission(
  view: InvitationView,
  draft: RsvpDraft,
): { ok: true; submission: RsvpSubmission } | { ok: false; problem: StepProblem; step: RsvpStep } {
  for (const step of ["attendance", "events", "meals", "dietary", "review"] as const) {
    const problem = stepProblem(view, draft, step);
    if (problem) return { ok: false, problem, step };
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

  // Only attending guests' dietary info is sent, so declining never wipes it.
  const dietary = view.guests
    .filter((g) => isGuestAttendingAny(view, draft, g.id))
    .map((g) => ({
      guest_id: g.id,
      dietary_restrictions: draft.dietaryDetails[g.id]?.trim() || null,
      dietary_tags: draft.dietaryTags[g.id] ?? [],
    }));

  const plus_ones = view.guests
    .filter((g) => g.is_plus_one && draft.attendance[g.id] === "attending")
    .map((g) => ({
      guest_id: g.id,
      first_name: draft.plusOneNames[g.id].first.trim(),
      last_name: draft.plusOneNames[g.id].last.trim() || null,
    }));

  return {
    ok: true,
    submission: {
      responses,
      dietary,
      plus_ones,
      contact_email: draft.email.trim() || null,
      message: draft.message.trim() || null,
    },
  };
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

/** Most recent saved answer time, for "Sent Sep 30". */
export function lastRespondedAt(view: InvitationView): string | null {
  const times = view.responses.filter((r) => r.status !== "pending").map((r) => r.updated_at);
  return times.length ? times.sort().at(-1)! : null;
}

/** Portal state from the handoff: A not responded, B responded, D after deadline (read-only). */
export type PortalState = "welcome" | "portal" | "closed";

export function portalState(view: InvitationView): PortalState {
  if (hasCompleteResponse(view)) return "portal";
  return view.rsvp_open ? "welcome" : "closed";
}

/** "John & Sarah" for greetings; unnamed plus-ones are left out. */
export function invitationNames(view: InvitationView): string {
  const names = view.guests
    .filter((g) => !(g.is_plus_one && isPlaceholderName(g)))
    .map((g) => g.display_name?.trim() || g.first_name.trim());
  if (names.length <= 1) return names[0] ?? "friends";
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
