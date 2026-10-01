/**
 * Cookie-aware Supabase client for Server Components, Server Actions, and
 * Route Handlers. Uses the publishable key plus the signed-in user's session,
 * so every query is subject to RLS. Create one per request.
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export async function createSupabaseServerClient() {
  // cookies() first: it marks the route as dynamic (per-request) before any
  // configuration check can run during a build.
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes sessions.
        }
      },
    },
  });
}
