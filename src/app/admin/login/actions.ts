"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error: string } | null;

/** Only same-site admin paths are allowed as post-login destinations. */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && /^\/admin(\/[A-Za-z0-9/_-]*)?$/.test(value) && value !== "/admin/login") {
    return value;
  }
  return "/admin/dashboard";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured. See README.md." };

  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { error: "Incorrect email or password." };

  // Signed in is not enough: the account must be on the admin allowlist.
  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "This account is not an administrator." };
  }

  redirect(safeNext(formData.get("next")));
}
