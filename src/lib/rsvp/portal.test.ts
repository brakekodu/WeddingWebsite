import { describe, expect, it } from "vitest";
import { dietarySummary, guestStatuses, mealSummary, personalEvents } from "./portal";
import type { InvitationView } from "./view";

const base = {
  description: null,
  starts_at: null,
  ends_at: null,
  time_zone: null,
  location_name: null,
  location_address: null,
  attire: null,
  guest_notes: null,
  meal_options: [],
};

const view: InvitationView = {
  guests: [
    {
      id: "john",
      first_name: "John",
      last_name: "Smith",
      display_name: null,
      dietary_restrictions: null,
      dietary_tags: [],
      is_plus_one: false,
      plus_one_host: null,
    },
    {
      id: "sarah",
      first_name: "Sarah",
      last_name: "Smith",
      display_name: null,
      dietary_restrictions: "celiac",
      dietary_tags: ["gluten_free"],
      is_plus_one: false,
      plus_one_host: null,
    },
    {
      id: "plus",
      first_name: "Guest",
      last_name: null,
      display_name: null,
      dietary_restrictions: null,
      dietary_tags: [],
      is_plus_one: true,
      plus_one_host: "John",
    },
  ],
  events: [
    {
      ...base,
      id: "dinner",
      name: "Reception",
      rsvp_required: true,
      meal_selection_required: true,
      guest_ids: ["john", "sarah", "plus"],
      meal_options: [{ id: "beef", name: "Beef", description: null }],
    },
    { ...base, id: "brunch", name: "Brunch", rsvp_required: true, meal_selection_required: false, guest_ids: ["john"] },
  ],
  responses: [
    { guest_id: "john", event_id: "dinner", status: "attending", meal_option_id: "beef", updated_at: "" },
    { guest_id: "sarah", event_id: "dinner", status: "attending", meal_option_id: "beef", updated_at: "" },
    { guest_id: "john", event_id: "brunch", status: "declined", meal_option_id: null, updated_at: "" },
  ],
  contact_email: null,
  guest_message: null,
  rsvp_deadline: null,
  rsvp_open: true,
};

describe("portal summaries", () => {
  it("lists who is attending each event, leaving out an unnamed plus-one", () => {
    expect(personalEvents(view).map((p) => [p.event.name, p.attending, p.notAttending])).toEqual([
      ["Reception", ["John", "Sarah"], []],
      ["Brunch", [], ["John"]],
    ]);
  });

  it("summarizes each guest's overall status", () => {
    expect(guestStatuses(view)).toEqual([
      { name: "John Smith", status: "attending" },
      { name: "Sarah Smith", status: "attending" },
    ]);
  });

  it("lists meals and dietary needs", () => {
    expect(mealSummary(view)).toEqual([
      { name: "John", event: "Reception", meal: "Beef" },
      { name: "Sarah", event: "Reception", meal: "Beef" },
    ]);
    expect(dietarySummary(view)).toEqual([{ name: "Sarah", needs: "Gluten-free · celiac" }]);
  });
});
