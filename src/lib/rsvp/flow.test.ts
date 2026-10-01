import { describe, expect, it } from "vitest";
import {
  buildSubmission,
  guestLabel,
  hasCompleteResponse,
  initialDraft,
  invitationNames,
  pairKey,
  portalState,
  rsvpPairs,
  stepProblem,
  stepsFor,
} from "./flow";
import type { InvitationView } from "./view";

type Ev = InvitationView["events"][number];
type Guest = InvitationView["guests"][number];

const event = (id: string, name: string, extra: Partial<Ev> = {}): Ev => ({
  id,
  name,
  description: null,
  starts_at: null,
  ends_at: null,
  time_zone: null,
  location_name: null,
  location_address: null,
  attire: null,
  guest_notes: null,
  rsvp_required: true,
  meal_selection_required: false,
  guest_ids: ["john", "sarah"],
  meal_options: [],
  ...extra,
});

const guest = (id: string, first: string, extra: Partial<Guest> = {}): Guest => ({
  id,
  first_name: first,
  last_name: "Smith",
  display_name: null,
  dietary_restrictions: null,
  dietary_tags: [],
  is_plus_one: false,
  plus_one_host: null,
  ...extra,
});

function smithView(overrides: Partial<InvitationView> = {}): InvitationView {
  return {
    guests: [guest("john", "John"), guest("sarah", "Sarah")],
    events: [
      event("ceremony", "Ceremony"),
      event("reception", "Reception", {
        meal_selection_required: true,
        meal_options: [
          { id: "meal-a", name: "Option A", description: null },
          { id: "meal-b", name: "Option B", description: null },
        ],
      }),
      event("afterparty", "After Party", { rsvp_required: false }),
    ],
    responses: [],
    contact_email: null,
    guest_message: null,
    rsvp_deadline: null,
    rsvp_open: true,
    ...overrides,
  };
}

/** The tap-only happy path: both accept, Yes to everything, meals chosen. */
function acceptAll(view: InvitationView) {
  const draft = initialDraft(view);
  draft.attendance = { john: "attending", sarah: "attending" };
  for (const p of rsvpPairs(view)) draft.events[p.key] = "attending";
  draft.meals[pairKey("john", "reception")] = "meal-a";
  draft.meals[pairKey("sarah", "reception")] = "meal-b";
  return draft;
}

describe("rsvpPairs", () => {
  it("includes only RSVP-required events and assigned guests", () => {
    const view = smithView();
    view.events[0].guest_ids = ["john"];
    expect(rsvpPairs(view).map((p) => p.key)).toEqual(["john:ceremony", "john:reception", "sarah:reception"]);
  });
});

describe("steps", () => {
  it("runs Attendance → Events → Dinner → Dietary → Review when someone attends a meal event", () => {
    const view = smithView();
    expect(stepsFor(view, acceptAll(view))).toEqual(["attendance", "events", "meals", "dietary", "review"]);
  });

  it("skips Dinner when nobody attending has a meal event", () => {
    const view = smithView();
    const draft = acceptAll(view);
    draft.events[pairKey("john", "reception")] = "declined";
    draft.events[pairKey("sarah", "reception")] = "declined";
    expect(stepsFor(view, draft)).toEqual(["attendance", "events", "dietary", "review"]);
  });

  it("skips straight to Review when everyone declines", () => {
    const view = smithView();
    const draft = initialDraft(view);
    draft.attendance = { john: "declined", sarah: "declined" };
    expect(stepsFor(view, draft)).toEqual(["attendance", "review"]);
  });
});

describe("validation", () => {
  it("names the first unanswered guest and targets their field", () => {
    const view = smithView();
    const draft = initialDraft(view);
    draft.attendance = { john: "attending" };
    expect(stepProblem(view, draft, "attendance")).toEqual({
      message: "Please choose an answer for Sarah.",
      targetId: "rsvp-attendance-sarah",
    });
  });

  it("requires an explicit Yes/No per accepted guest per event", () => {
    const view = smithView();
    const draft = initialDraft(view);
    draft.attendance = { john: "attending", sarah: "declined" };
    draft.events[pairKey("john", "ceremony")] = "attending";
    expect(stepProblem(view, draft, "events")?.message).toBe("Choose Yes or No for John at the Reception.");
  });

  it("requires a meal for each attending guest at a meal event", () => {
    const view = smithView();
    const draft = acceptAll(view);
    delete draft.meals[pairKey("sarah", "reception")];
    expect(stepProblem(view, draft, "meals")?.targetId).toBe("rsvp-meal-sarah-reception");
  });

  it("checks the optional email only when given", () => {
    const view = smithView();
    const draft = acceptAll(view);
    expect(stepProblem(view, draft, "review")).toBeNull();
    draft.email = "nope";
    expect(stepProblem(view, draft, "review")?.message).toMatch(/email/);
  });
});

describe("buildSubmission", () => {
  it("builds the acceptance-test RSVP with dietary chips, note, and email", () => {
    const view = smithView();
    const draft = acceptAll(view);
    draft.dietaryTags.sarah = ["gluten_free"];
    draft.dietaryDetails.sarah = "  celiac ";
    draft.message = " Congrats! ";
    draft.email = "john@example.com";
    const result = buildSubmission(view, draft);
    expect(result).toEqual({
      ok: true,
      submission: {
        responses: [
          { guest_id: "john", event_id: "ceremony", status: "attending", meal_option_id: null },
          { guest_id: "sarah", event_id: "ceremony", status: "attending", meal_option_id: null },
          { guest_id: "john", event_id: "reception", status: "attending", meal_option_id: "meal-a" },
          { guest_id: "sarah", event_id: "reception", status: "attending", meal_option_id: "meal-b" },
        ],
        dietary: [
          { guest_id: "john", dietary_restrictions: null, dietary_tags: [] },
          { guest_id: "sarah", dietary_restrictions: "celiac", dietary_tags: ["gluten_free"] },
        ],
        plus_ones: [],
        contact_email: "john@example.com",
        message: "Congrats!",
      },
    });
  });

  it("declines every event for someone who declines in step 1, ignoring stale step-2 answers", () => {
    const view = smithView();
    const draft = acceptAll(view);
    draft.attendance.sarah = "declined";
    const result = buildSubmission(view, draft);
    if (!result.ok) throw new Error(result.problem.message);
    expect(result.submission.responses.filter((r) => r.guest_id === "sarah")).toEqual([
      { guest_id: "sarah", event_id: "ceremony", status: "declined", meal_option_id: null },
      { guest_id: "sarah", event_id: "reception", status: "declined", meal_option_id: null },
    ]);
    expect(result.submission.dietary.map((d) => d.guest_id)).toEqual(["john"]);
  });

  it("reports which step to fix", () => {
    const view = smithView();
    const draft = acceptAll(view);
    delete draft.events[pairKey("john", "ceremony")];
    expect(buildSubmission(view, draft)).toMatchObject({ ok: false, step: "events" });
  });
});

describe("plus-ones", () => {
  const withPlusOne = () => {
    const view = smithView();
    view.guests.push(guest("plus", "Guest", { last_name: null, is_plus_one: true, plus_one_host: "John" }));
    view.events[0].guest_ids.push("plus");
    return view;
  };

  it("is labeled by host until named, and requires a name when bringing", () => {
    const view = withPlusOne();
    const draft = acceptAll(view);
    expect(guestLabel(view.guests[2], draft)).toBe("John's guest");
    draft.attendance.plus = "attending";
    expect(stepProblem(view, draft, "attendance")?.targetId).toBe("rsvp-plusone-plus");
    draft.plusOneNames.plus = { first: "Alex", last: "" };
    expect(guestLabel(view.guests[2], draft)).toBe("Alex");
    draft.events[pairKey("plus", "ceremony")] = "attending";
    const result = buildSubmission(view, draft);
    if (!result.ok) throw new Error(result.problem.message);
    expect(result.submission.plus_ones).toEqual([{ guest_id: "plus", first_name: "Alex", last_name: null }]);
  });

  it("sends no name when not bringing a guest, and leaves them out of greetings", () => {
    const view = withPlusOne();
    const draft = acceptAll(view);
    draft.attendance.plus = "declined";
    const result = buildSubmission(view, draft);
    if (!result.ok) throw new Error(result.problem.message);
    expect(result.submission.plus_ones).toEqual([]);
    expect(invitationNames(view)).toBe("John & Sarah");
  });
});

describe("returning guests", () => {
  const answered = (): InvitationView =>
    smithView({
      responses: [
        {
          guest_id: "john",
          event_id: "ceremony",
          status: "attending",
          meal_option_id: null,
          updated_at: "2026-09-30T12:00:00Z",
        },
        {
          guest_id: "john",
          event_id: "reception",
          status: "attending",
          meal_option_id: "meal-a",
          updated_at: "2026-09-30T12:00:00Z",
        },
        {
          guest_id: "sarah",
          event_id: "ceremony",
          status: "declined",
          meal_option_id: null,
          updated_at: "2026-09-30T12:00:00Z",
        },
        {
          guest_id: "sarah",
          event_id: "reception",
          status: "declined",
          meal_option_id: null,
          updated_at: "2026-09-30T12:00:00Z",
        },
      ],
      contact_email: "john@example.com",
    });

  it("restores saved answers so editing starts complete", () => {
    const view = answered();
    const draft = initialDraft(view);
    expect(draft.attendance).toEqual({ john: "attending", sarah: "declined" });
    expect(draft.meals[pairKey("john", "reception")]).toBe("meal-a");
    expect(draft.email).toBe("john@example.com");
    expect(hasCompleteResponse(view)).toBe(true);
    expect(buildSubmission(view, draft).ok).toBe(true);
  });

  it("computes portal state from responses and the deadline", () => {
    expect(portalState(smithView())).toBe("welcome");
    expect(portalState(answered())).toBe("portal");
    expect(portalState(smithView({ rsvp_open: false }))).toBe("closed");
  });

  it("drops a saved meal that is no longer offered", () => {
    const view = smithView({
      responses: [
        { guest_id: "john", event_id: "reception", status: "attending", meal_option_id: "retired", updated_at: "" },
      ],
    });
    expect(initialDraft(view).meals[pairKey("john", "reception")]).toBeUndefined();
  });
});
