import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ANON, as, createTestDatabase, queryAs, rpcAs, seedScenario, type Scenario } from "./harness";

const PUBLIC_TABLES = [
  "admin_users",
  "households",
  "guests",
  "events",
  "guest_events",
  "meal_options",
  "invitations",
  "invitation_guests",
  "rsvps",
  "meal_selections",
  "rsvp_activity",
];

let db: PGlite;
let s: Scenario;

beforeAll(async () => {
  db = await createTestDatabase();
  s = await seedScenario(db);
});

describe("schema", () => {
  it("enables RLS on every table in public and private", async () => {
    const { rows } = await db.query<{ table: string; rls: boolean }>(`
      select n.nspname || '.' || c.relname as table, c.relrowsecurity as rls
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind = 'r' and n.nspname in ('public', 'private')
    `);
    expect(rows.length).toBeGreaterThanOrEqual(PUBLIC_TABLES.length + 1);
    expect(rows.filter((r) => !r.rls)).toEqual([]);
  });
});

describe("anonymous visitors", () => {
  it.each(PUBLIC_TABLES)("cannot read %s", async (table) => {
    await expect(queryAs(db, ANON, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
  });

  it("cannot write households or guests", async () => {
    await expect(queryAs(db, ANON, `insert into households (display_name) values ('x')`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(queryAs(db, ANON, `update guests set first_name = 'x'`)).rejects.toThrow(/permission denied/);
  });

  it("cannot touch the private schema", async () => {
    await expect(queryAs(db, ANON, `select * from private.rsvp_code_failures`)).rejects.toThrow(/permission denied/);
    await expect(queryAs(db, ANON, `select private.is_admin()`)).rejects.toThrow(/permission denied/);
    await expect(queryAs(db, ANON, `select private.new_invitation_token()`)).rejects.toThrow(/permission denied/);
  });

  it("cannot call admin RPCs", async () => {
    await expect(rpcAs(db, ANON, "regenerate_invitation_token", [s.smithInvitationId])).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("authenticated users who are not admins", () => {
  it.each(PUBLIC_TABLES)("see no rows in %s", async (table) => {
    const rows = await queryAs(db, s.outsider, `select * from public.${table}`);
    expect(rows).toEqual([]);
  });

  it("cannot insert or update data", async () => {
    await expect(queryAs(db, s.outsider, `insert into households (display_name) values ('x')`)).rejects.toThrow(
      /row-level security/,
    );
    const updated = await queryAs(db, s.outsider, `update guests set first_name = 'Hacked' returning id`);
    expect(updated).toEqual([]);
  });

  it("cannot grant themselves admin", async () => {
    if (s.outsider.role !== "authenticated") throw new Error("unexpected actor");
    await expect(
      queryAs(db, s.outsider, `insert into admin_users (user_id, email) values ($1, 'x')`, [s.outsider.userId]),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot regenerate tokens", async () => {
    await expect(rpcAs(db, s.outsider, "regenerate_invitation_token", [s.smithInvitationId])).rejects.toThrow(
      /not_authorized/,
    );
  });
});

describe("admins", () => {
  it("can read all wedding data", async () => {
    const guests = await queryAs(db, s.admin, `select id from guests`);
    expect(guests).toHaveLength(3);
    const activity = await queryAs(db, s.admin, `select id from rsvp_activity`);
    expect(Array.isArray(activity)).toBe(true);
  });

  it("cannot write rsvp_activity directly (append-only via functions)", async () => {
    await expect(
      queryAs(db, s.admin, `insert into rsvp_activity (invitation_id, activity_type) values ($1, 'rsvp_started')`, [
        s.smithInvitationId,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot add other admins through the API", async () => {
    await expect(queryAs(db, s.admin, `delete from admin_users`)).rejects.toThrow(/permission denied/);
  });
});

describe("invitation credentials", () => {
  it("generates a 24-char base64url token and an 8-char unambiguous code", () => {
    expect(s.smithToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(s.smithCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it("ignores client-supplied credentials on insert", async () => {
    const [row] = await queryAs<{ token: string; rsvp_code: string }>(
      db,
      s.admin,
      `insert into invitations (label, token, rsvp_code) values ('Chosen', 'AAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAA') returning token, rsvp_code`,
    );
    expect(row.token).not.toBe("AAAAAAAAAAAAAAAAAAAAAAAA");
    expect(row.rsvp_code).not.toBe("AAAAAAAA");
  });

  it("produces distinct tokens", async () => {
    const rows = await queryAs<{ token: string }>(
      db,
      s.admin,
      `insert into invitations (label) select 'bulk ' || g from generate_series(1, 50) g returning token`,
    );
    expect(new Set(rows.map((r) => r.token)).size).toBe(50);
  });

  it("rejects direct token edits", async () => {
    await expect(
      queryAs(db, s.admin, `update invitations set token = 'BBBBBBBBBBBBBBBBBBBBBBBB' where id = $1`, [
        s.smithInvitationId,
      ]),
    ).rejects.toThrow(/regenerate_invitation_token/);
  });

  it("regenerates token and code for a draft invitation and resets validation", async () => {
    const [created] = await queryAs<{ id: string; token: string; rsvp_code: string }>(
      db,
      s.admin,
      `insert into invitations (label) values ('Rotate me') returning id, token, rsvp_code`,
    );
    await queryAs(
      db,
      s.admin,
      `update invitations set qr_validation_status = 'passed', validated_at = now(), validated_url = 'x', print_status = 'proof_printed' where id = $1`,
      [created.id],
    );
    await rpcAs(db, s.admin, "regenerate_invitation_token", [created.id]);
    const [after] = await queryAs<{
      token: string;
      rsvp_code: string;
      qr_validation_status: string;
      validated_url: string | null;
      print_status: string;
    }>(db, s.admin, `select * from invitations where id = $1`, [created.id]);
    expect(after.token).not.toBe(created.token);
    expect(after.rsvp_code).not.toBe(created.rsvp_code);
    expect(after.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(after.qr_validation_status).toBe("not_validated");
    expect(after.validated_url).toBeNull();
    expect(after.print_status).toBe("not_printed");
  });

  it("makes the token immutable once locked, and locking is one-way", async () => {
    const [created] = await queryAs<{ id: string; token: string }>(
      db,
      s.admin,
      `insert into invitations (label) values ('Lock me') returning id, token`,
    );
    const [locked] = await queryAs<{ locked_at: string | null; status: string }>(
      db,
      s.admin,
      `update invitations set status = 'locked' where id = $1 returning locked_at, status`,
      [created.id],
    );
    expect(locked.status).toBe("locked");
    expect(locked.locked_at).not.toBeNull();

    await expect(rpcAs(db, s.admin, "regenerate_invitation_token", [created.id])).rejects.toThrow(/locked/);
    await expect(
      queryAs(db, s.admin, `update invitations set status = 'draft' where id = $1`, [created.id]),
    ).rejects.toThrow(/cannot return to draft/);
    const [unchanged] = await queryAs<{ token: string; locked_at: string | null }>(
      db,
      s.admin,
      `update invitations set locked_at = null where id = $1 returning token, locked_at`,
      [created.id],
    );
    expect(unchanged.token).toBe(created.token);
    expect(unchanged.locked_at).not.toBeNull();
  });

  it("requires lock and passed validation before marking printed", async () => {
    const [created] = await queryAs<{ id: string }>(
      db,
      s.admin,
      `insert into invitations (label) values ('Print me') returning id`,
    );
    await expect(
      queryAs(db, s.admin, `update invitations set print_status = 'printed' where id = $1`, [created.id]),
    ).rejects.toThrow(/Lock the invitation/);
    await queryAs(db, s.admin, `update invitations set status = 'locked' where id = $1`, [created.id]);
    await expect(
      queryAs(db, s.admin, `update invitations set print_status = 'printed' where id = $1`, [created.id]),
    ).rejects.toThrow(/Validate the QR code/);
    await queryAs(
      db,
      s.admin,
      `update invitations set qr_validation_status = 'passed', validated_at = now() where id = $1`,
      [created.id],
    );
    const [printed] = await queryAs<{ printed_at: string | null }>(
      db,
      s.admin,
      `update invitations set print_status = 'printed' where id = $1 returning printed_at`,
      [created.id],
    );
    expect(printed.printed_at).not.toBeNull();
    await expect(
      queryAs(db, s.admin, `update invitations set print_status = 'not_printed' where id = $1`, [created.id]),
    ).rejects.toThrow(/cannot be marked unprinted/);
  });

  it("resets QR validation when the invitation's guests change", async () => {
    const [created] = await queryAs<{ id: string }>(
      db,
      s.admin,
      `insert into invitations (label) values ('Guests change') returning id`,
    );
    await queryAs(
      db,
      s.admin,
      `update invitations set qr_validation_status = 'passed', validated_at = now() where id = $1`,
      [created.id],
    );
    await queryAs(db, s.admin, `insert into invitation_guests (invitation_id, guest_id) values ($1, $2)`, [
      created.id,
      s.bobId,
    ]);
    const [row] = await queryAs<{ qr_validation_status: string }>(
      db,
      s.admin,
      `select qr_validation_status from invitations where id = $1`,
      [created.id],
    );
    expect(row.qr_validation_status).toBe("not_validated");
  });
});

describe("referential integrity", () => {
  it("rejects an RSVP for an event the guest is not assigned to", async () => {
    await expect(
      as(db, s.admin, (tx) =>
        tx.query(`insert into rsvps (guest_id, event_id, status) values ($1, $2, 'attending')`, [
          s.johnId,
          s.rehearsalDinnerId,
        ]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("rejects a meal selection whose meal belongs to another event", async () => {
    await expect(
      as(db, s.admin, (tx) =>
        tx.query(`insert into meal_selections (guest_id, event_id, meal_option_id) values ($1, $2, $3)`, [
          s.johnId,
          s.receptionId,
          s.rehearsalMealId,
        ]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("rejects meal selection required without RSVP", async () => {
    await expect(
      queryAs(
        db,
        s.admin,
        `insert into events (name, rsvp_required, meal_selection_required) values ('Bad', false, true)`,
      ),
    ).rejects.toThrow(/events_meal_requires_rsvp/);
  });
});
