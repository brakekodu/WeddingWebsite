/**
 * Admin authorization for Server Components, Server Actions, and Route Handlers.
 *
 * Being signed in is not enough: the user must be listed in public.admin_users.
 * RLS enforces the same rule in the database; this check gives clear errors
 * and redirects before any query runs.
 */
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
};

/** Returns the admin context, or null when signed out or not an admin. Cached per request. */
export const getAdmin = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: row } = await supabase.from("admin_users").select("user_id, email").eq("user_id", userId).maybeSingle();
  if (!row) return null;

  return { supabase, userId, email: row.email };
});

/** For pages and layouts: redirects to the login page when not an admin. */
export async function requireAdminPage(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export class NotAuthorizedError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "NotAuthorizedError";
  }
}

/** For server actions and route handlers: throws when not an admin. */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) throw new NotAuthorizedError();
  return admin;
}
