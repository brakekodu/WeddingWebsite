"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** `email` is echoed back so a failed attempt doesn't clear the field. */
export type LoginState = { error: string; email?: string } | null;

/** Only same-site admin paths are allowed as post-login destinations. */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && /^\/admin(\/[A-Za-z0-9/_-]*)?$/.test(value) && value !== "/admin/login") {
    return value;
  }
  return "/admin/dashboard";
}

/** Turns Supabase Auth errors into specific, fixable messages. */
function signInErrorMessage(error: { code?: string; status?: number; message?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password. Passwords are case-sensitive — use the eye button to check what you typed.";
    case "email_not_confirmed":
      return "This account hasn't been confirmed yet. In Supabase → Authentication → Users, delete it and add it again with “Auto Confirm User” ticked.";
    case "user_banned":
      return "This account is disabled.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many sign-in attempts. Please wait a few minutes and try again.";
    default:
      console.error("Admin sign-in failed:", error.code, error.status, error.message);
      return `Couldn't sign in right now (${error.code ?? error.status ?? "unknown error"}). Please try again.`;
  }
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured. See README.md." };

  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password.", email: typeof email === "string" ? email : "" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user || !data.session) {
    return { error: error ? signInErrorMessage(error) : "Couldn't sign in. Please try again.", email };
  }

  // Signed in is not enough: the account must be on the admin allowlist.
  // Check with the just-issued access token explicitly, so the result never
  // depends on whether the new session cookie is readable within this request.
  const { url, publishableKey } = getSupabasePublicEnv();
  const asUser = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  const { data: admin, error: adminError } = await asUser
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (adminError) {
    console.error("Admin check failed:", adminError);
    await supabase.auth.signOut();
    return { error: `Signed in, but couldn't check admin access (${adminError.code}). Please try again.`, email };
  }
  if (!admin) {
    await supabase.auth.signOut();
    return {
      error: "Your password worked, but this account isn't an administrator yet. Run the admin SQL step in Supabase.",
      email,
    };
  }

  redirect(safeNext(formData.get("next")));
}
