/**
 * In-process Postgres (PGlite) harness for migration and RLS tests.
 *
 * Emulates the parts of Supabase our migrations depend on: the anon /
 * authenticated / service_role roles, Supabase's default grants on the public
 * schema, auth.users, auth.uid(), and pgcrypto in the `extensions` schema.
 * No Docker or hosted project is required.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../supabase/migrations");

const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(
      coalesce(
        current_setting('request.jwt.claim.sub', true),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      ),
      ''
    )::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;

  -- Supabase's default privileges: everything in public is granted to the
  -- API roles, and RLS is what actually protects data.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema extensions;
  create extension pgcrypto schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`Migration failed: ${path.basename(file)}: ${(error as Error).message}`);
    }
  }
  return db;
}

export type Actor = { role: "anon" } | { role: "authenticated"; userId: string } | { role: "service_role" };

export const ANON: Actor = { role: "anon" };

/** Run `fn` the way PostgREST would: in a transaction, as the given role, with JWT claims set. */
export async function as<T>(db: PGlite, actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${actor.role}`);
    const claims = actor.role === "authenticated" ? { sub: actor.userId, role: "authenticated" } : { role: actor.role };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    return fn(tx);
  });
}

/** Run a single statement as an actor and return its rows. */
export async function queryAs<R = Record<string, unknown>>(
  db: PGlite,
  actor: Actor,
  sql: string,
  params: unknown[] = [],
): Promise<R[]> {
  return as(db, actor, async (tx) => (await tx.query<R>(sql, params)).rows);
}

/** Call an RPC function as an actor and return its single scalar result. */
export async function rpcAs<R = unknown>(db: PGlite, actor: Actor, fn: string, args: unknown[] = []): Promise<R> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await queryAs<{ result: R }>(db, actor, `select public.${fn}(${placeholders}) as result`, args);
  return rows[0].result;
}

export async function createAuthUser(db: PGlite, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
  return rows[0].id;
}

export async function createAdmin(db: PGlite, email: string): Promise<Actor> {
  const userId = await createAuthUser(db, email);
  await db.query(`insert into public.admin_users (user_id, email) values ($1, $2)`, [userId, email]);
  return { role: "authenticated", userId };
}

export interface Scenario {
  admin: Actor;
  outsider: Actor;
  smithHouseholdId: string;
  johnId: string;
  sarahId: string;
  bobId: string;
  ceremonyId: string;
  receptionId: string;
  rehearsalDinnerId: string;
  chickenId: string;
  pastaId: string;
  retiredMealId: string;
  rehearsalMealId: string;
  smithInvitationId: string;
  smithToken: string;
  smithCode: string;
  bobInvitationId: string;
  bobToken: string;
}

/**
 * The acceptance-test scenario (John + Sarah, Ceremony + Reception), plus a
 * second household invited to a private event, created through the admin role.
 */
export async function seedScenario(db: PGlite): Promise<Scenario> {
  const admin = await createAdmin(db, "admin@example.com");
  const outsiderId = await createAuthUser(db, "outsider@example.com");
  const outsider: Actor = { role: "authenticated", userId: outsiderId };

  return as(db, admin, async (tx) => {
    const one = async (sql: string, params: unknown[] = []) => (await tx.query<{ id: string }>(sql, params)).rows[0].id;

    const smithHouseholdId = await one(
      `insert into households (display_name, primary_email) values ('Smith Household', 'smiths@example.com') returning id`,
    );
    const jonesHouseholdId = await one(`insert into households (display_name) values ('Jones Household') returning id`);
    const johnId = await one(
      `insert into guests (household_id, first_name, last_name, email, phone) values ($1, 'John', 'Smith', 'john@example.com', '555-0100') returning id`,
      [smithHouseholdId],
    );
    const sarahId = await one(
      `insert into guests (household_id, first_name, last_name) values ($1, 'Sarah', 'Smith') returning id`,
      [smithHouseholdId],
    );
    const bobId = await one(
      `insert into guests (household_id, first_name, last_name, notes) values ($1, 'Bob', 'Jones', 'secret admin note') returning id`,
      [jonesHouseholdId],
    );

    const ceremonyId = await one(
      `insert into events (name, starts_at, display_order) values ('Ceremony', '2027-06-12 16:00', 1) returning id`,
    );
    const receptionId = await one(
      `insert into events (name, starts_at, meal_selection_required, display_order) values ('Reception', '2027-06-12 18:00', true, 2) returning id`,
    );
    const rehearsalDinnerId = await one(
      `insert into events (name, starts_at, meal_selection_required, display_order) values ('Rehearsal Dinner', '2027-06-11 19:00', true, 0) returning id`,
    );

    const chickenId = await one(
      `insert into meal_options (event_id, name, display_order) values ($1, 'Option A', 1) returning id`,
      [receptionId],
    );
    const pastaId = await one(
      `insert into meal_options (event_id, name, display_order) values ($1, 'Option B', 2) returning id`,
      [receptionId],
    );
    const retiredMealId = await one(
      `insert into meal_options (event_id, name, is_active) values ($1, 'Retired option', false) returning id`,
      [receptionId],
    );
    const rehearsalMealId = await one(
      `insert into meal_options (event_id, name) values ($1, 'Rehearsal option') returning id`,
      [rehearsalDinnerId],
    );

    for (const guestId of [johnId, sarahId, bobId]) {
      for (const eventId of [ceremonyId, receptionId]) {
        await tx.query(`insert into guest_events (guest_id, event_id) values ($1, $2)`, [guestId, eventId]);
      }
    }
    await tx.query(`insert into guest_events (guest_id, event_id) values ($1, $2)`, [bobId, rehearsalDinnerId]);

    const smith = (
      await tx.query<{ id: string; token: string; rsvp_code: string }>(
        `insert into invitations (household_id, label) values ($1, 'Smith Household') returning id, token, rsvp_code`,
        [smithHouseholdId],
      )
    ).rows[0];
    await tx.query(
      `insert into invitation_guests (invitation_id, guest_id, display_order) values ($1, $2, 0), ($1, $3, 1)`,
      [smith.id, johnId, sarahId],
    );

    const bob = (
      await tx.query<{ id: string; token: string }>(
        `insert into invitations (household_id, label) values ($1, 'Jones Household') returning id, token`,
        [jonesHouseholdId],
      )
    ).rows[0];
    await tx.query(`insert into invitation_guests (invitation_id, guest_id) values ($1, $2)`, [bob.id, bobId]);

    return {
      admin,
      outsider,
      smithHouseholdId,
      johnId,
      sarahId,
      bobId,
      ceremonyId,
      receptionId,
      rehearsalDinnerId,
      chickenId,
      pastaId,
      retiredMealId,
      rehearsalMealId,
      smithInvitationId: smith.id,
      smithToken: smith.token,
      smithCode: smith.rsvp_code,
      bobInvitationId: bob.id,
      bobToken: bob.token,
    };
  });
}
