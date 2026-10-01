/**
 * Automated end-to-end check of the Phase 1 vertical slice against the hosted
 * Supabase project, through the same APIs, RLS policies, and RPC functions the
 * app uses:
 *
 *   household → John + Sarah → Ceremony + Reception → assignments → invitation
 *   → token + code → guest view ("Welcome, John & Sarah.") → RSVP with meals
 *   → dashboard metrics → QR validation → lock/immutability → activity log
 *
 * It creates a temporary admin user and clearly labeled test data, and deletes
 * all of it at the end (even on failure). Requires .env.local with
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * SUPABASE_SECRET_KEY, and APP_BASE_URL, and migrations pushed.
 *
 *   npm run verify:remote
 *
 * This does not replace clicking through the UI once; it proves the backend.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { computeDashboardMetrics } from "../src/lib/dashboard/metrics";
import { formatGreeting } from "../src/lib/invitations/greeting";
import { validateInvitationQr } from "../src/lib/invitations/validation";
import { buildSubmission, initialDraft, pairKey, rsvpPairs } from "../src/lib/rsvp/flow";
import { invitationViewSchema, submitResultSchema } from "../src/lib/rsvp/view";
import type { Database } from "../src/lib/supabase/database.types";
import { loadLocalEnv, requireEnv } from "./lib/env";

loadLocalEnv();
const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = requireEnv("SUPABASE_SECRET_KEY");
const baseUrl = requireEnv("APP_BASE_URL");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient<Database>(url, secretKey, noSession);
const anon = createClient<Database>(url, publishableKey, noSession);
const admin = createClient<Database>(url, publishableKey, noSession);
const outsider = createClient<Database>(url, publishableKey, noSession);

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}
function must<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
  label: string,
): NonNullable<R["data"]> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`${label}: ${result.error?.message ?? "no data"}`);
  }
  return result.data as NonNullable<R["data"]>;
}

const suffix = randomBytes(4).toString("hex");
const created = {
  users: [] as string[],
  household: "",
  guests: [] as string[],
  events: [] as string[],
  invitation: "",
};

async function createUser(label: string, grantAdmin: boolean) {
  const email = `verify-${label}-${suffix}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  created.users.push(data.user.id);
  if (grantAdmin)
    must(await service.from("admin_users").insert({ user_id: data.user.id, email }).select(), "grant admin");
  return { email, password };
}

async function run() {
  const adminCreds = await createUser("admin", true);
  const outsiderCreds = await createUser("outsider", false);
  for (const [client, creds] of [
    [admin, adminCreds],
    [outsider, outsiderCreds],
  ] as const) {
    const { error } = await client.auth.signInWithPassword(creds);
    if (error) throw new Error(`sign-in: ${error.message}`);
  }

  // --- Admin builds the scenario (through RLS) ---------------------------
  const household = must(
    await admin
      .from("households")
      .insert({ display_name: `Smith Household (verify ${suffix})` })
      .select()
      .single(),
    "create household",
  );
  created.household = household.id;
  const guests = must(
    await admin
      .from("guests")
      .insert([
        { household_id: household.id, first_name: "John", last_name: "Smith" },
        { household_id: household.id, first_name: "Sarah", last_name: "Smith" },
      ])
      .select(),
    "create guests",
  );
  created.guests = guests.map((g) => g.id);
  const [john, sarah] = guests;

  const events = must(
    await admin
      .from("events")
      .insert([
        { name: `Ceremony (verify ${suffix})`, display_order: 9001 },
        { name: `Reception (verify ${suffix})`, meal_selection_required: true, display_order: 9002 },
      ])
      .select(),
    "create events",
  );
  created.events = events.map((e) => e.id);
  const reception = events[1];
  const meals = must(
    await admin
      .from("meal_options")
      .insert([
        { event_id: reception.id, name: "Option A", display_order: 1 },
        { event_id: reception.id, name: "Option B", display_order: 2 },
      ])
      .select(),
    "create meal options",
  );
  must(
    await admin
      .from("guest_events")
      .insert(guests.flatMap((g) => events.map((e) => ({ guest_id: g.id, event_id: e.id }))))
      .select(),
    "assign events",
  );

  const invitation = must(
    await admin
      .from("invitations")
      .insert({ household_id: household.id, label: household.display_name })
      .select()
      .single(),
    "create invitation",
  );
  created.invitation = invitation.id;
  must(
    await admin
      .from("invitation_guests")
      .insert([
        { invitation_id: invitation.id, guest_id: john.id, display_order: 0 },
        { invitation_id: invitation.id, guest_id: sarah.id, display_order: 1 },
      ])
      .select(),
    "associate guests",
  );
  check("Token is 24-char base64url", /^[A-Za-z0-9_-]{24}$/.test(invitation.token), invitation.token.length);
  check("RSVP code is 6 unambiguous characters", /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(invitation.rsvp_code));

  // --- RLS -----------------------------------------------------------------
  const anonGuests = await anon.from("guests").select("id");
  check("Anonymous visitors cannot read guests", anonGuests.error !== null || (anonGuests.data ?? []).length === 0);
  const outsiderGuests = await outsider.from("guests").select("id");
  check("Signed-in non-admins see no guests", (outsiderGuests.data ?? []).length === 0, outsiderGuests.error?.message);
  const outsiderWrite = await outsider.from("households").insert({ display_name: "x" }).select();
  check("Signed-in non-admins cannot write", outsiderWrite.error !== null);

  // --- Guest experience (anonymous, token only) ------------------------------
  const viewResult = await anon.rpc("get_invitation", { p_token: invitation.token });
  const view = invitationViewSchema.parse(viewResult.data);
  check(
    'Greeting is "Welcome, John & Sarah."',
    formatGreeting(view.guests) === "Welcome, John & Sarah.",
    formatGreeting(view.guests),
  );
  check(
    "Guest view shows exactly the 2 assigned events",
    view.events.length === 2,
    view.events.map((e) => e.name),
  );
  check("Guest view has no contact details", !JSON.stringify(view).match(/email|phone|address_line|notes/));

  const codeResult = await anon.rpc("resolve_rsvp_code", { p_code: invitation.rsvp_code.toLowerCase() });
  check(
    "Fallback RSVP code resolves to the same invitation",
    (codeResult.data as { token?: string })?.token === invitation.token,
  );

  const started = await anon.rpc("record_rsvp_started", { p_token: invitation.token });
  check("RSVP start recorded", started.error === null, started.error?.message);
  const draft = initialDraft(view);
  draft.attendance = { [john.id]: "attending", [sarah.id]: "attending" };
  for (const p of rsvpPairs(view)) draft.events[p.key] = "attending";
  draft.meals[pairKey(john.id, reception.id)] = meals[0].id;
  draft.meals[pairKey(sarah.id, reception.id)] = meals[1].id;
  draft.dietaryTags[sarah.id] = ["shellfish"];
  draft.dietaryDetails[sarah.id] = "Shellfish allergy (verification)";
  const built = buildSubmission(view, draft);
  if (!built.ok) throw new Error(built.problem.message);
  const submit = await anon.rpc("submit_rsvp", { p_token: invitation.token, p_payload: built.submission });
  const submitted = submitResultSchema.safeParse(submit.data);
  check(
    "RSVP saved to Supabase",
    submitted.success && submitted.data.result === "rsvp_completed",
    submit.error?.message,
  );

  // --- Admin dashboard metrics (scoped to the test data) ---------------------
  const [ig, ge, rs, ms, mo, gs] = await Promise.all([
    admin.from("invitation_guests").select("invitation_id, guest_id").eq("invitation_id", invitation.id),
    admin.from("guest_events").select("guest_id, event_id").in("guest_id", created.guests),
    admin.from("rsvps").select("guest_id, event_id, status").in("guest_id", created.guests),
    admin.from("meal_selections").select("guest_id, event_id, meal_option_id").in("guest_id", created.guests),
    admin.from("meal_options").select("id, event_id, name, is_active").in("event_id", created.events),
    admin.from("guests").select("id, first_name, last_name, dietary_restrictions").in("id", created.guests),
  ]);
  const freshInvitation = must(await admin.from("invitations").select("*").eq("id", invitation.id).single(), "reload");
  const metrics = computeDashboardMetrics({
    baseUrl,
    householdsCount: 1,
    invitations: [freshInvitation],
    invitationGuests: ig.data ?? [],
    guests: gs.data ?? [],
    events,
    guestEvents: ge.data ?? [],
    rsvps: rs.data ?? [],
    mealSelections: ms.data ?? [],
    mealOptions: mo.data ?? [],
  });
  check(
    "Dashboard: 2 guests invited, 2 attending, 0 outstanding",
    metrics.totals.guestsInvited === 2 && metrics.totals.attending === 2 && metrics.totals.outstanding === 0,
    metrics.totals,
  );
  check("Dashboard: 100% responses", metrics.totals.responsePercent === 100, metrics.totals.responsePercent);
  const receptionMeals = metrics.events.find((e) => e.id === reception.id)?.meals.map((m) => m.count);
  check("Dashboard: meal totals 1 + 1", JSON.stringify(receptionMeals) === "[1,1]", receptionMeals);
  check("Dashboard: dietary restriction listed", metrics.dietary.length === 1, metrics.dietary);

  // --- QR validation ------------------------------------------------------
  const result = await validateInvitationQr({
    invitation: { id: invitation.id, token: invitation.token, guestIds: created.guests },
    baseUrl,
    findInvitationIdByToken: async (token) =>
      (await admin.from("invitations").select("id").eq("token", token).maybeSingle()).data?.id ?? null,
    resolvePublicGuestIds: async (token) => {
      const r = await admin.rpc("get_invitation", { p_token: token });
      return r.data ? invitationViewSchema.parse(r.data).guests.map((g) => g.id) : null;
    },
  });
  check(
    "QR validation passes all checks",
    result.status === "passed",
    result.checks.filter((c) => !c.passed),
  );
  must(
    await admin
      .from("invitations")
      .update({
        qr_validation_status: result.status,
        validated_at: result.checkedAt,
        validated_url: result.expectedUrl,
      })
      .eq("id", invitation.id)
      .select(),
    "save validation",
  );

  // --- Lock & immutability ---------------------------------------------------
  must(await admin.from("invitations").update({ status: "locked" }).eq("id", invitation.id).select(), "lock");
  const regen = await admin.rpc("regenerate_invitation_token", { p_invitation_id: invitation.id });
  check("Locked invitation's token cannot be regenerated", regen.error !== null);

  // --- Activity log --------------------------------------------------------
  const activity = must(
    await admin.from("rsvp_activity").select("activity_type").eq("invitation_id", invitation.id),
    "activity",
  ).map((a) => a.activity_type);
  check(
    "Activity log has accessed → started → completed",
    (["invitation_accessed", "rsvp_started", "rsvp_completed"] as const).every((t) => activity.includes(t)),
    activity,
  );
}

async function cleanup() {
  // Service role bypasses RLS so cleanup succeeds even if a check failed midway.
  if (created.invitation) await service.from("invitations").delete().eq("id", created.invitation);
  if (created.events.length) await service.from("events").delete().in("id", created.events);
  if (created.guests.length) await service.from("guests").delete().in("id", created.guests);
  if (created.household) await service.from("households").delete().eq("id", created.household);
  for (const id of created.users) await service.auth.admin.deleteUser(id);
  console.log("Cleaned up temporary users and test data.");
}

async function main() {
  try {
    await run();
  } catch (error) {
    failures++;
    console.error("✗ Verification aborted:", (error as Error).message);
  } finally {
    await cleanup();
  }
  console.log(failures === 0 ? "\nAll remote checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
