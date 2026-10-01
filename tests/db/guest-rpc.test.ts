import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { ANON, createTestDatabase, queryAs, rpcAs, seedScenario, type Scenario } from "./harness";

interface InvitationView {
  guests: { id: string; first_name: string; last_name: string | null }[];
  events: {
    id: string;
    name: string;
    guest_ids: string[];
    meal_options: { id: string; name: string }[];
  }[];
  responses: { guest_id: string; event_id: string; status: string; meal_option_id: string | null }[];
}

let db: PGlite;
let s: Scenario;

beforeEach(async () => {
  db = await createTestDatabase();
  s = await seedScenario(db);
});

const activity = (invitationId: string) =>
  queryAs<{ activity_type: string; actor: string }>(
    db,
    s.admin,
    `select activity_type, actor from rsvp_activity where invitation_id = $1 order by id`,
    [invitationId],
  );

function fullResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    responses: [
      { guest_id: s.johnId, event_id: s.ceremonyId, status: "attending", meal_option_id: null },
      { guest_id: s.johnId, event_id: s.receptionId, status: "attending", meal_option_id: s.chickenId },
      { guest_id: s.sarahId, event_id: s.ceremonyId, status: "attending", meal_option_id: null },
      { guest_id: s.sarahId, event_id: s.receptionId, status: "attending", meal_option_id: s.pastaId },
    ],
    dietary: [
      { guest_id: s.johnId, dietary_restrictions: "" },
      { guest_id: s.sarahId, dietary_restrictions: "Shellfish allergy" },
    ],
    ...overrides,
  };
}

describe("get_invitation", () => {
  it("returns only this invitation's guests and their assigned events", async () => {
    const view = await rpcAs<InvitationView>(db, ANON, "get_invitation", [s.smithToken]);
    expect(view.guests.map((g) => g.first_name)).toEqual(["John", "Sarah"]);
    expect(view.events.map((e) => e.name)).toEqual(["Ceremony", "Reception"]);
    const reception = view.events.find((e) => e.name === "Reception")!;
    expect(reception.guest_ids.sort()).toEqual([s.johnId, s.sarahId].sort());
    // Only active options, only for meal events.
    expect(reception.meal_options.map((m) => m.name)).toEqual(["Option A", "Option B"]);
    expect(view.events.find((e) => e.name === "Ceremony")!.meal_options).toEqual([]);
  });

  it("never reveals a private event, other guests, or contact details", async () => {
    const view = await rpcAs<InvitationView>(db, ANON, "get_invitation", [s.smithToken]);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(s.rehearsalDinnerId);
    expect(serialized).not.toContain("Rehearsal");
    expect(serialized).not.toContain(s.bobId);
    expect(serialized).not.toContain("Bob");
    expect(serialized).not.toContain("john@example.com");
    expect(serialized).not.toContain("555-0100");
    expect(serialized).not.toContain("smiths@example.com");
    expect(serialized).not.toContain(s.smithInvitationId);
    expect(serialized).not.toContain(s.smithHouseholdId);
  });

  it("shows a private event to the guest who is assigned to it", async () => {
    const view = await rpcAs<InvitationView>(db, ANON, "get_invitation", [s.bobToken]);
    expect(view.events.map((e) => e.name)).toEqual(["Rehearsal Dinner", "Ceremony", "Reception"]);
    expect(JSON.stringify(view)).not.toContain("secret admin note");
  });

  it("returns null for unknown, malformed, and void tokens", async () => {
    expect(await rpcAs(db, ANON, "get_invitation", ["x".repeat(24)])).toBeNull();
    expect(await rpcAs(db, ANON, "get_invitation", ["not a token"])).toBeNull();
    expect(await rpcAs(db, ANON, "get_invitation", [null])).toBeNull();
    await queryAs(db, s.admin, `update invitations set status = 'void' where id = $1`, [s.smithInvitationId]);
    expect(await rpcAs(db, ANON, "get_invitation", [s.smithToken])).toBeNull();
  });

  it("logs guest access at most once per window and never logs admin previews", async () => {
    await rpcAs(db, ANON, "get_invitation", [s.smithToken]);
    await rpcAs(db, ANON, "get_invitation", [s.smithToken]);
    await rpcAs(db, s.admin, "get_invitation", [s.bobToken]);
    expect(await activity(s.smithInvitationId)).toEqual([{ activity_type: "invitation_accessed", actor: "guest" }]);
    expect(await activity(s.bobInvitationId)).toEqual([]);
  });
});

describe("record_rsvp_started", () => {
  it("logs rsvp_started for guests", async () => {
    await rpcAs(db, ANON, "record_rsvp_started", [s.smithToken]);
    expect(await activity(s.smithInvitationId)).toEqual([{ activity_type: "rsvp_started", actor: "guest" }]);
  });
});

describe("submit_rsvp", () => {
  it("saves attendance, meals, and dietary restrictions", async () => {
    const result = await rpcAs<{ result: string; invitation: InvitationView }>(db, ANON, "submit_rsvp", [
      s.smithToken,
      fullResponse(),
    ]);
    expect(result.result).toBe("rsvp_completed");
    expect(result.invitation.responses).toHaveLength(4);

    const rsvps = await queryAs<{ status: string }>(
      db,
      s.admin,
      `select status from rsvps where guest_id in ($1, $2)`,
      [s.johnId, s.sarahId],
    );
    expect(rsvps.map((r) => r.status)).toEqual(Array(4).fill("attending"));

    const meals = await queryAs<{ guest_id: string; meal_option_id: string }>(
      db,
      s.admin,
      `select guest_id, meal_option_id from meal_selections order by guest_id`,
    );
    expect(meals).toHaveLength(2);
    expect(meals.find((m) => m.guest_id === s.sarahId)!.meal_option_id).toBe(s.pastaId);

    const [sarah] = await queryAs<{ dietary_restrictions: string | null }>(
      db,
      s.admin,
      `select dietary_restrictions from guests where id = $1`,
      [s.sarahId],
    );
    expect(sarah.dietary_restrictions).toBe("Shellfish allergy");
    expect(await activity(s.smithInvitationId)).toEqual([{ activity_type: "rsvp_completed", actor: "guest" }]);
  });

  it("allows editing later through the same token", async () => {
    await rpcAs(db, ANON, "submit_rsvp", [s.smithToken, fullResponse()]);
    const declined = fullResponse({
      responses: [
        { guest_id: s.johnId, event_id: s.ceremonyId, status: "attending", meal_option_id: null },
        { guest_id: s.johnId, event_id: s.receptionId, status: "attending", meal_option_id: s.pastaId },
        { guest_id: s.sarahId, event_id: s.ceremonyId, status: "declined", meal_option_id: null },
        { guest_id: s.sarahId, event_id: s.receptionId, status: "declined", meal_option_id: null },
      ],
    });
    const result = await rpcAs<{ result: string }>(db, ANON, "submit_rsvp", [s.smithToken, declined]);
    expect(result.result).toBe("rsvp_updated");

    const meals = await queryAs<{ guest_id: string; meal_option_id: string }>(
      db,
      s.admin,
      `select guest_id, meal_option_id from meal_selections`,
    );
    expect(meals).toEqual([{ guest_id: s.johnId, meal_option_id: s.pastaId }]);
  });

  it("records admin-entered responses as admin activity", async () => {
    await rpcAs(db, s.admin, "submit_rsvp", [s.smithToken, fullResponse()]);
    expect(await activity(s.smithInvitationId)).toEqual([{ activity_type: "rsvp_completed", actor: "admin" }]);
  });

  const rejects = (payload: unknown, error: RegExp, token?: string) =>
    expect(rpcAs(db, ANON, "submit_rsvp", [token ?? s.smithToken, payload])).rejects.toThrow(error);

  it("rejects unknown tokens", async () => {
    await rejects(fullResponse(), /invitation_not_found/, "y".repeat(24));
  });

  it("rejects incomplete responses", async () => {
    const payload = fullResponse();
    payload.responses.pop();
    await rejects(payload, /response_incomplete/);
  });

  it("rejects answers for guests on another invitation", async () => {
    const payload = fullResponse();
    payload.responses.push({
      guest_id: s.bobId,
      event_id: s.ceremonyId,
      status: "attending",
      meal_option_id: null,
    });
    await rejects(payload, /response_not_allowed/);
  });

  it("rejects answers for events the guest is not invited to", async () => {
    const payload = fullResponse();
    payload.responses.push({
      guest_id: s.johnId,
      event_id: s.rehearsalDinnerId,
      status: "attending",
      meal_option_id: s.rehearsalMealId,
    });
    await rejects(payload, /response_not_allowed/);
  });

  it("rejects dietary updates for guests on another invitation", async () => {
    await rejects(
      fullResponse({ dietary: [{ guest_id: s.bobId, dietary_restrictions: "x" }] }),
      /response_not_allowed/,
    );
  });

  it("requires a meal when attending a meal event", async () => {
    const payload = fullResponse();
    payload.responses[1].meal_option_id = null;
    await rejects(payload, /meal_required/);
  });

  it("rejects meals from another event, inactive meals, and meals on non-meal events", async () => {
    const otherEvent = fullResponse();
    otherEvent.responses[1].meal_option_id = s.rehearsalMealId;
    await rejects(otherEvent, /invalid_meal/);

    const inactive = fullResponse();
    inactive.responses[1].meal_option_id = s.retiredMealId;
    await rejects(inactive, /invalid_meal/);

    const nonMealEvent = fullResponse();
    nonMealEvent.responses[0].meal_option_id = s.chickenId;
    await rejects(nonMealEvent, /invalid_meal/);

    const declinedWithMeal = fullResponse();
    declinedWithMeal.responses[1].status = "declined";
    await rejects(declinedWithMeal, /invalid_meal/);
  });

  it("rejects malformed payloads", async () => {
    const badUuid = fullResponse();
    badUuid.responses[0].guest_id = "nope";
    await rejects(badUuid, /invalid_payload/);

    const pending = fullResponse();
    pending.responses[0].status = "pending";
    await rejects(pending, /invalid_payload/);

    const unknownStatus = fullResponse();
    unknownStatus.responses[0].status = "maybe";
    await rejects(unknownStatus, /invalid_payload/);

    const duplicate = fullResponse();
    duplicate.responses.push({ ...duplicate.responses[0] });
    await rejects(duplicate, /invalid_payload/);

    await rejects({ responses: "nope" }, /invalid_payload/);
    await rejects({ responses: [1, 2] }, /invalid_payload/);
  });

  it("blocks deleting a chosen meal option but allows deleting its whole event", async () => {
    await rpcAs(db, ANON, "submit_rsvp", [s.smithToken, fullResponse()]);
    await expect(queryAs(db, s.admin, `delete from meal_options where id = $1`, [s.chickenId])).rejects.toThrow(
      /foreign key/,
    );
    await queryAs(db, s.admin, `delete from events where id = $1`, [s.receptionId]);
    expect(await queryAs(db, s.admin, `select * from meal_selections`)).toEqual([]);
    expect(await queryAs(db, s.admin, `select * from rsvps where event_id = $1`, [s.receptionId])).toEqual([]);
  });

  it("writes nothing when a submission is rejected", async () => {
    const payload = fullResponse();
    payload.responses[1].meal_option_id = null;
    await rejects(payload, /meal_required/);
    expect(await queryAs(db, s.admin, `select * from rsvps`)).toEqual([]);
    expect(await activity(s.smithInvitationId)).toEqual([]);
  });
});

describe("resolve_rsvp_code", () => {
  it("resolves a code typed in any case with separators", async () => {
    const typed = `${s.smithCode.slice(0, 4).toLowerCase()}-${s.smithCode.slice(4)}`;
    expect(await rpcAs(db, ANON, "resolve_rsvp_code", [typed])).toEqual({
      status: "ok",
      token: s.smithToken,
    });
  });

  it("does not resolve unknown or void codes", async () => {
    expect(await rpcAs(db, ANON, "resolve_rsvp_code", ["ZZZZZZZZ"])).toEqual({
      status: "not_found",
    });
    await queryAs(db, s.admin, `update invitations set status = 'void' where id = $1`, [s.smithInvitationId]);
    expect(await rpcAs(db, ANON, "resolve_rsvp_code", [s.smithCode])).toEqual({
      status: "not_found",
    });
  });

  it("throttles all lookups after repeated failures", async () => {
    for (let i = 0; i < 50; i++) {
      await rpcAs(db, ANON, "resolve_rsvp_code", ["WRONG" + i]);
    }
    expect(await rpcAs(db, ANON, "resolve_rsvp_code", [s.smithCode])).toEqual({
      status: "throttled",
    });
  });
});
