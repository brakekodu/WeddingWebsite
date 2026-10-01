/**
 * PRIVILEGED Supabase client using the secret (service-role) key.
 * It BYPASSES Row Level Security.
 *
 * Rules:
 *   - Server-only. The `server-only` import makes any client-side import a
 *     build error, and the key has no NEXT_PUBLIC_ prefix.
 *   - Use only for operations that cannot be expressed through RLS or the
 *     guest RPC functions, and always authorize the caller first.
 *   - Phase 1 does not need it at runtime: admin pages use the signed-in
 *     admin's session (RLS) and guests use SECURITY DEFINER RPCs.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, MissingEnvError } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new MissingEnvError("SUPABASE_SECRET_KEY", "It is server-only and never NEXT_PUBLIC_.");
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
