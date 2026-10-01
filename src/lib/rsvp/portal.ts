/** Derived data for the personalized portal and personal schedule. Pure and tested. */
import { dietaryLabel } from "@/lib/rsvp/dietary";
import { guestLabel, isPlaceholderName, pairKey } from "@/lib/rsvp/flow";
import type { InvitationEvent, InvitationGuest, InvitationView } from "@/lib/rsvp/view";

export interface PersonalEvent {
  event: InvitationEvent;
  /** Names of this invitation's guests invited to the event. */
  invited: string[];
  attending: string[];
  notAttending: string[];
}

function visibleGuests(view: InvitationView): InvitationGuest[] {
  // An unnamed plus-one who hasn't been brought isn't a person yet.
  return view.guests.filter((g) => !(g.is_plus_one && isPlaceholderName(g)));
}

export function personalEvents(view: InvitationView): PersonalEvent[] {
  const status = new Map(view.responses.map((r) => [pairKey(r.guest_id, r.event_id), r.status]));
  const guests = visibleGuests(view);
  return view.events.map((event) => {
    const invitedGuests = guests.filter((g) => event.guest_ids.includes(g.id));
    const names = (pred: (g: InvitationGuest) => boolean) => invitedGuests.filter(pred).map((g) => guestLabel(g));
    return {
      event,
      invited: names(() => true),
      attending: names((g) => status.get(pairKey(g.id, event.id)) === "attending"),
      notAttending: names((g) => status.get(pairKey(g.id, event.id)) === "declined"),
    };
  });
}

/** Per-guest overall status for the RSVP summary card. */
export function guestStatuses(view: InvitationView): { name: string; status: "attending" | "declined" | "pending" }[] {
  return visibleGuests(view)
    .map((g) => {
      const answers = view.responses.filter((r) => r.guest_id === g.id).map((r) => r.status);
      const relevant = view.events.some((e) => e.rsvp_required && e.guest_ids.includes(g.id));
      if (!relevant) return null;
      const status = answers.includes("attending")
        ? ("attending" as const)
        : answers.length > 0 && answers.every((a) => a === "declined")
          ? ("declined" as const)
          : ("pending" as const);
      return { name: [g.display_name?.trim() || g.first_name, g.last_name].filter(Boolean).join(" "), status };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/** "John — Beef entrée" lines for every attending meal choice. */
export function mealSummary(view: InvitationView): { name: string; event: string; meal: string }[] {
  // Invitation order (guests), then schedule order (events).
  const lines: { name: string; event: string; meal: string }[] = [];
  for (const guest of view.guests) {
    for (const event of view.events) {
      const r = view.responses.find((x) => x.guest_id === guest.id && x.event_id === event.id);
      if (r?.status !== "attending" || !r.meal_option_id) continue;
      const meal = event.meal_options.find((m) => m.id === r.meal_option_id);
      if (meal) lines.push({ name: guestLabel(guest), event: event.name, meal: meal.name });
    }
  }
  return lines;
}

/** "Sarah — Gluten-free · severe" for guests with dietary needs. */
export function dietarySummary(view: InvitationView): { name: string; needs: string }[] {
  return view.guests
    .filter((g) => g.dietary_tags.length > 0 || g.dietary_restrictions?.trim())
    .map((g) => ({
      name: guestLabel(g),
      needs: [g.dietary_tags.map(dietaryLabel).join(", "), g.dietary_restrictions?.trim()].filter(Boolean).join(" · "),
    }));
}
