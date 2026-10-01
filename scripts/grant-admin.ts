/**
 * Grants (or revokes) wedding-admin access for an existing Supabase Auth user.
 *
 *   npm run admin:grant -- someone@example.com
 *   npm run admin:grant -- someone@example.com --revoke
 *
 * Create the Auth user first (Supabase Dashboard → Authentication → Users →
 * Add user). Uses SUPABASE_SECRET_KEY from .env.local; run it on your own
 * machine only. Admin membership cannot be changed through the app.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { loadLocalEnv, requireEnv } from "./lib/env";

loadLocalEnv();

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes("--revoke");
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:grant -- someone@example.com [--revoke]");
  process.exit(1);
}

const supabase = createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUser(target: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match || data.users.length < 200) return match ?? null;
  }
}

async function main(target: string) {
  const user = await findUser(target);
  if (!user) {
    console.error(`No Auth user with email ${target}. Create it in Supabase: Authentication → Users → Add user.`);
    process.exit(1);
  }

  if (revoke) {
    const { error } = await supabase.from("admin_users").delete().eq("user_id", user.id);
    if (error) throw error;
    console.log(`Revoked admin access for ${target}.`);
  } else {
    const { error } = await supabase.from("admin_users").upsert({ user_id: user.id, email: user.email ?? target });
    if (error) throw error;
    console.log(`Granted admin access to ${target}.`);
  }
}

main(email).catch((error: unknown) => {
  console.error((error as Error).message ?? error);
  process.exit(1);
});
