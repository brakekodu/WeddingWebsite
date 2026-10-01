import { describe, expect, it } from "vitest";
import { buildSubmission, hasCompleteResponse, initialDraft, pairKey, rsvpPairs, stepProblem, stepsFor } from "./flow";
import type { InvitationView } from "./view";

const event = (id: string, name: string, extra: Partial<InvitationView["events"][number]> = {}) => ({
  id,
  name,
  description: null,
  starts_at: null,
  ends_at: null,
  time_zone: null,
  location_name: null,
  location_address: null,
  rsvp_required: true,
  meal_selection_required: false,
  guest_ids: ["john", "sarah"],
  meal_options: [],
  ...extra,
});

const guest = (id: string, first: string) => ({
  id,
  first_name: first,
  last_name: "Smith",
  display_name: null,
  dietary_restrictions: null,
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
    ...overrides,
  };
}

describe("rsvpPairs", () => {
  it("includes only RSVP-required events and assigned guests", () => {
    const view = smithView();
    view.events[0].guest_ids = ["john"];
    expect(rsvpPairs(view).map((p) => p.key)).toEqual(["john:ceremony", "john:reception", "sarah:reception"]);
  });
});

describe("stepsFor", () => {
  it("walks attendance -> events -> meals -> dietary -> review when attending", () => {
    const view = smithView();
    const draft = initialDraft(view);
    expect(stepsFor(view, draft)).toEqual(["welcome", "attendance", "review"]);
    draft.guestAttendance = { john: "attending", sarah: "attending" };
    expect(stepsFor(view, draft)).toEqual(["welcome", "attendance", "events", "meals", "dietary", "review"]);
  });

  it("skips everything after attendance when everyone declines", () => {
    const view = smithView();
    const draft = initialDraft(view);
    draft.guestAttendance = { john: "declined", sarah: "declined" };
    expect(stepsFor(view, draft)).toEqual(["welcome", "attendance", "review"]);
  });
});

describe("buildSubmission", () => {
  it("requires every person to answer and every attendee to pick a meal", () => {
    const view = smithView();
    const draft = initialDraft(view);
    expect(buildSubmission(view, draft)).toMatchObject({ ok: false });
    draft.guestAttendance = { john: "attending", sarah: "attending" };
    expect(stepProblem(view, draft, "meals")).toMatch(/choose a meal/);
  });

  it("builds a complete payload for the acceptance-test RSVP", () => {
    const view = smithView();
    const draft = initialDraft(view);
    draft.guestAttendance = { john: "attending", sarah: "attending" };
    draft.meals[pairKey("john", "reception")] = "meal-a";
    draft.meals[pairKey("sarah", "reception")] = "meal-b";
    draft.dietary.sarah = "  Shellfish allergy ";
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
          { guest_id: "john", dietary_restrictions: null },
          { guest_id: "sarah", dietary_restrictions: "Shellfish allergy" },
        ],
      },
    });
  });

  it("declines every event for a person who declines, sending no meal or dietary data", () => {
    const view = smithView();
    const draft = initialDraft(view);
    draft.guestAttendance = { john: "attending", sarah: "declined" };
    draft.eventAttendance[pairKey("john", "reception")] = "declined";
    draft.meals[pairKey("sarah", "reception")] = "meal-b"; // stale UI state is ignored
    const result = buildSubmission(view, draft);
    if (!result.ok) throw new Error(result.error);
    expect(result.submission.responses).toEqual([
      { guest_id: "john", event_id: "ceremony", status: "attending", meal_option_id: null },
      { guest_id: "sarah", event_id: "ceremony", status: "declined", meal_option_id: null },
      { guest_id: "john", event_id: "reception", status: "declined", meal_option_id: null },
      { guest_id: "sarah", event_id: "reception", status: "declined", meal_option_id: null },
    ]);
    expect(result.submission.dietary.map((d) => d.guest_id)).toEqual(["john"]);
  });
});

describe("initialDraft", () => {
  it("restores saved answers so guests can edit later", () => {
    const view = smithView({
      responses: [
        { guest_id: "john", event_id: "ceremony", status: "attending", meal_option_id: null, updated_at: "" },
        { guest_id: "john", event_id: "reception", status: "attending", meal_option_id: "meal-a", updated_at: "" },
        { guest_id: "sarah", event_id: "ceremony", status: "declined", meal_option_id: null, updated_at: "" },
        { guest_id: "sarah", event_id: "reception", status: "declined", meal_option_id: null, updated_at: "" },
      ],
    });
    const draft = initialDraft(view);
    expect(draft.guestAttendance).toEqual({ john: "attending", sarah: "declined" });
    expect(draft.meals[pairKey("john", "reception")]).toBe("meal-a");
    expect(hasCompleteResponse(view)).toBe(true);
    expect(buildSubmission(view, draft).ok).toBe(true);
  });

  it("drops a saved meal that is no longer offered", () => {
    const view = smithView({
      responses: [
        { guest_id: "john", event_id: "reception", status: "attending", meal_option_id: "retired", updated_at: "" },
      ],
    });
    expect(initialDraft(view).meals[pairKey("john", "reception")]).toBeUndefined();
    expect(hasCompleteResponse(view)).toBe(false);
  });
});
