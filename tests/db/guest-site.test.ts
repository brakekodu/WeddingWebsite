import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { ANON, createTestDatabase, queryAs, rpcAs, seedScenario, type Scenario } from "./harness";

interface PublicSite {
  events: { id: string; name: string; attire: string | null }[];
  rsvp_deadline: string | null;
}
interface View {
  guests: {
    id: string;
    first_name: string;
    is_plus_one: boolean;
    plus_one_host: string | null;
    dietary_tags: string[];
  }[];
  events: { id: string; name: string; attire: string | null; guest_notes: string | null }[];
  contact_email: string | null;
  guest_message: string | null;
  rsvp_deadline: string | null;
  rsvp_open: boolean;
}

let db: PGlite;
let s: Scenario;
let plusOneId: string;
let draftEventId: string;

beforeEach(async () => {
  db = await createTestDatabase();
  s = await seedScenario(db);
  // John may bring a guest; the plus-one is an unnamed placeholder on the Smith invitation.
  [{ id: plusOneId }] = await queryAs<{ id: string }>(
    db,
    s.admin,
    `insert into guests (household_id, first_name, plus_one_of) values ($1, 'Guest', $2) returning id`,
    [s.smithHouseholdId, s.johnId],
  );
  await queryAs(
    db,
    s.admin,
    `insert into invitation_guests (invitation_id, guest_id, display_order) values ($1, $2, 2)`,
    [s.smithInvitationId, plusOneId],
  );
  await queryAs(db, s.admin, `insert into guest_events (guest_id, event_id) values ($1, $2)`, [
    plusOneId,
    s.ceremonyId,
  ]);
  // Ceremony is public with attire; a draft event is assigned to John but must stay hidden.
  await queryAs(db, s.admin, `update events set visibility = 'public', attire = 'Garden formal' where id = $1`, [
    s.ceremonyId,
  ]);
  [{ id: draftEventId }] = await queryAs<{ id: string }>(
    db,
    s.admin,
    `insert into events (name, visibility) values ('Secret draft', 'draft') returning id`,
  );
  await queryAs(db, s.admin, `insert into guest_events (guest_id, event_id) values ($1, $2)`, [s.johnId, draftEventId]);
});

function payload(overrides: Record<string, unknown> = {}) {
  return {
    responses: [
      { guest_id: s.johnId, event_id: s.ceremonyId, status: "attending", meal_option_id: null },
      { guest_id: s.johnId, event_id: s.receptionId, status: "attending", meal_option_id: s.chickenId },
      { guest_id: s.sarahId, event_id: s.ceremonyId, status: "attending", meal_option_id: null },
      { guest_id: s.sarahId, event_id: s.receptionId, status: "declined", meal_option_id: null },
      { guest_id: plusOneId, event_id: s.ceremonyId, status: "attending", meal_option_id: null },
    ],
    dietary: [{ guest_id: s.johnId, dietary_restrictions: "Severe", dietary_tags: ["gluten_free", "nut_allergy"] }],
    plus_ones: [{ guest_id: plusOneId, first_name: "Alex", last_name: "Rivera" }],
    contact_email: "john@example.com",
    message: "Can't wait!",
    ...overrides,
  };
}

describe("public site data", () => {
  it("contains only public events, never invite-only or draft", async () => {
    const site = await rpcAs<PublicSite>(db, ANON, "get_public_site");
    expect(site.events.map((e) => e.name)).toEqual(["Ceremony"]);
    expect(site.events[0].attire).toBe("Garden formal");
    const json = JSON.stringify(site);
    expect(json).not.toContain("Rehearsal");
    expect(json).not.toContain("Secret draft");
    expect(json).not.toContain("Reception");
  });

  it("does not expose settings tables to anonymous visitors", async () => {
    await expect(queryAs(db, ANON, `select * from wedding_settings`)).rejects.toThrow(/permission denied/);
  });
});

describe("invitation view", () => {
  it("hides draft events even when assigned, and describes plus-ones", async () => {
    const view = await rpcAs<View>(db, ANON, "get_invitation", [s.smithToken]);
    expect(view.events.map((e) => e.name)).toEqual(["Ceremony", "Reception"]);
    expect(JSON.stringify(view)).not.toContain(draftEventId);
    const plusOne = view.guests.find((g) => g.id === plusOneId)!;
    expect(plusOne).toMatchObject({ is_plus_one: true, plus_one_host: "John", first_name: "Guest" });
    expect(view.rsvp_open).toBe(true);
  });
});

describe("submit_rsvp additions", () => {
  it("saves plus-one names, dietary chips, email, and a note", async () => {
    const result = await rpcAs<{ result: string; invitation: View }>(db, ANON, "submit_rsvp", [
      s.smithToken,
      payload(),
    ]);
    expect(result.result).toBe("rsvp_completed");
    expect(result.invitation.contact_email).toBe("john@example.com");
    expect(result.invitation.guest_message).toBe("Can't wait!");
    const [alex] = await queryAs<{ first_name: string; last_name: string }>(
      db,
      s.admin,
      `select first_name, last_name from guests where id = $1`,
      [plusOneId],
    );
    expect(alex).toEqual({ first_name: "Alex", last_name: "Rivera" });
    const [john] = await queryAs<{ dietary_tags: string[]; dietary_restrictions: string }>(
      db,
      s.admin,
      `select dietary_tags, dietary_restrictions from guests where id = $1`,
      [s.johnId],
    );
    expect(john).toEqual({ dietary_tags: ["gluten_free", "nut_allergy"], dietary_restrictions: "Severe" });
  });

  it("only lets plus-one guests be renamed", async () => {
    await expect(
      rpcAs(db, ANON, "submit_rsvp", [
        s.smithToken,
        payload({ plus_ones: [{ guest_id: s.sarahId, first_name: "Hacked", last_name: null }] }),
      ]),
    ).rejects.toThrow(/response_not_allowed/);
  });

  it("rejects unknown dietary chips and malformed emails", async () => {
    await expect(
      rpcAs(db, ANON, "submit_rsvp", [
        s.smithToken,
        payload({ dietary: [{ guest_id: s.johnId, dietary_restrictions: null, dietary_tags: ["carnivore"] }] }),
      ]),
    ).rejects.toThrow(/invalid_payload/);
    await expect(
      rpcAs(db, ANON, "submit_rsvp", [s.smithToken, payload({ contact_email: "not-an-email" })]),
    ).rejects.toThrow(/invalid_payload/);
  });

  it("does not accept answers for draft events", async () => {
    const p = payload();
    p.responses.push({ guest_id: s.johnId, event_id: draftEventId, status: "attending", meal_option_id: null });
    await expect(rpcAs(db, ANON, "submit_rsvp", [s.smithToken, p])).rejects.toThrow(/response_not_allowed/);
  });
});

describe("RSVP deadline", () => {
  it("closes guest submissions after the deadline but lets admins record RSVPs", async () => {
    await queryAs(db, s.admin, `update wedding_settings set rsvp_deadline = current_date - 2, time_zone = 'UTC'`);
    const view = await rpcAs<View>(db, ANON, "get_invitation", [s.smithToken]);
    expect(view.rsvp_open).toBe(false);
    await expect(rpcAs(db, ANON, "submit_rsvp", [s.smithToken, payload()])).rejects.toThrow(/rsvp_closed/);
    const asAdmin = await rpcAs<{ result: string }>(db, s.admin, "submit_rsvp", [s.smithToken, payload()]);
    expect(asAdmin.result).toBe("rsvp_completed");
  });

  it("stays open through the end of the deadline day", async () => {
    await queryAs(db, s.admin, `update wedding_settings set rsvp_deadline = current_date + 1, time_zone = 'UTC'`);
    expect((await rpcAs<View>(db, ANON, "get_invitation", [s.smithToken])).rsvp_open).toBe(true);
  });

  it("rejects invalid time zones and non-admin edits", async () => {
    await expect(queryAs(db, s.admin, `update wedding_settings set time_zone = 'Mars/Olympus'`)).rejects.toThrow(
      /time_zone_valid/,
    );
    const updated = await queryAs(
      db,
      s.outsider,
      `update wedding_settings set rsvp_deadline = current_date returning id`,
    );
    expect(updated).toEqual([]);
  });
});

describe("RSVP codes", () => {
  it("are 6 characters and resolve", async () => {
    expect(s.smithCode).toHaveLength(6);
    expect(await rpcAs(db, ANON, "resolve_rsvp_code", [s.smithCode.toLowerCase()])).toEqual({
      status: "ok",
      token: s.smithToken,
    });
  });
});
