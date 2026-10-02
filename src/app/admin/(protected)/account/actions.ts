"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { runAdminAction, UserFacingError } from "@/lib/admin/actions";

/** Lets a signed-in admin replace the password they were given. */
export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const password = fd.get("password");
    const confirm = fd.get("confirm");
    if (typeof password !== "string" || password.length < 12) {
      throw new UserFacingError("Use at least 12 characters.");
    }
    if (password !== confirm) throw new UserFacingError("The two passwords don't match.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new UserFacingError(error.message || "Couldn't change the password.");
    return "Password changed. Use it next time you sign in.";
  });
}
