import { describe, expect, it } from "vitest";
import { buildInvitationUrl } from "@/lib/invitations/url";
import { computeDashboardMetrics, type DashboardInput } from "./metrics";

const BASE = "https://example.com";
const TOKEN_A = "AAAAAAAAAAAAAAAAAAAAAAAA";
const TOKEN_B = "BBBBBBBBBBBBBBBBBBBBBBBB";

function scenario(): DashboardInput {
  return {
    baseUrl: BASE,
    householdsCount: 2,
    invitations: [
      {
        id: "smith",
        status: "draft",
        token: TOKEN_A,
        qr_validation_status: "passed",
        validated_url: buildInvitationUrl(BASE, TOKEN_A),
      },
      { id: "jones", status: "draft", token: TOKEN_B, qr_validation_status: "not_validated", validated_url: null },
      {
        id: "void",
        status: "void",
        token: "CCCCCCCCCCCCCCCCCCCCCCCC",
        qr_validation_status: "failed",
        validated_url: null,
      },
    ],
    invitationGuests: [
      { invitation_id: "smith", guest_id: "john" },
      { invitation_id: "smith", guest_id: "sarah" },
      { invitation_id: "jones", guest_id: "bob" },
      { invitation_id: "void", guest_id: "ghost" },
    ],
    guests: [
      { id: "john", first_name: "John", last_name: "Smith", dietary_restrictions: null },
      { id: "sarah", first_name: "Sarah", last_name: "Smith", dietary_restrictions: "Shellfish allergy" },
      { id: "bob", first_name: "Bob", last_name: "Jones", dietary_restrictions: "Vegan" },
      { id: "ghost", first_name: "Ghost", last_name: null, dietary_restrictions: null },
    ],
    events: [
      { id: "ceremony", name: "Ceremony", rsvp_required: true, meal_selection_required: false },
      { id: "reception", name: "Reception", rsvp_required: true, meal_selection_required: true },
    ],
    guestEvents: ["john", "sarah", "bob", "ghost"].flatMap((g) => [
      { guest_id: g, event_id: "ceremony" },
      { guest_id: g, event_id: "reception" },
    ]),
    rsvps: [
      { guest_id: "john", event_id: "ceremony", status: "attending" },
      { guest_id: "john", event_id: "reception", status: "attending" },
      { guest_id: "sarah", event_id: "ceremony", status: "attending" },
      { guest_id: "sarah", event_id: "reception", status: "attending" },
    ],
    mealSelections: [{ guest_id: "john", event_id: "reception", meal_option_id: "a" }],
    mealOptions: [
      { id: "a", event_id: "reception", name: "Option A", is_active: true },
      { id: "b", event_id: "reception", name: "Option B", is_active: true },
    ],
  };
}

describe("computeDashboardMetrics", () => {
  it("computes headline totals, ignoring void invitations", () => {
    const { totals } = computeDashboardMetrics(scenario());
    expect(totals).toEqual({
      guestsInvited: 3,
      households: 2,
      invitations: 2,
      invitationsAwaitingResponse: 2,
      responsesReceived: 1,
      responsePercent: 50,
      attending: 2,
      declined: 0,
      outstanding: 1,
      noRsvpNeeded: 0,
      guestsWithoutInvitation: 1,
    });
  });

  it("computes per-event attendance and meal totals", () => {
    const { events, missingMeals } = computeDashboardMetrics(scenario());
    const reception = events.find((e) => e.id === "reception")!;
    expect(reception).toMatchObject({ invited: 3, attending: 2, declined: 0, pending: 1, missingMeals: 1 });
    expect(reception.meals.map((m) => [m.name, m.count])).toEqual([
      ["Option A", 1],
      ["Option B", 0],
    ]);
    expect(missingMeals).toEqual([{ guestName: "Sarah Smith", eventName: "Reception" }]);
  });

  it("lists dietary restrictions only for attending guests", () => {
    expect(computeDashboardMetrics(scenario()).dietary).toEqual([
      { guestName: "Sarah Smith", restrictions: "Shellfish allergy" },
    ]);
  });

  it("counts a guest who declined everything as declined", () => {
    const input = scenario();
    input.rsvps.push(
      { guest_id: "bob", event_id: "ceremony", status: "declined" },
      { guest_id: "bob", event_id: "reception", status: "declined" },
    );
    const { totals } = computeDashboardMetrics(input);
    expect(totals).toMatchObject({ declined: 1, outstanding: 0, responsesReceived: 2, responsePercent: 100 });
  });

  it("summarizes QR validation, including stale results after a domain change", () => {
    expect(computeDashboardMetrics(scenario()).qr).toEqual({ passed: 1, failed: 0, stale: 0, notValidated: 1 });
    expect(computeDashboardMetrics({ ...scenario(), baseUrl: "https://new.example" }).qr).toEqual({
      passed: 0,
      failed: 0,
      stale: 1,
      notValidated: 1,
    });
  });
});
