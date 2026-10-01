/**
 * Browser Supabase client. Browser-safe: it only ever holds the publishable
 * key and the signed-in user's own session, and RLS governs all access.
 *
 * Phase 1 performs all data access on the server, so nothing imports this yet.
 * Never import privileged keys or src/lib/supabase/admin.ts from client code.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseBrowserClient() {
  // Literal process.env access so Next.js inlines these NEXT_PUBLIC_ values.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.");
  }
  return createBrowserClient<Database>(url, key);
}
