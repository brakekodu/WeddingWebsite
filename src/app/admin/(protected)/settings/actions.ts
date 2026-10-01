"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { formText, runAdminAction, throwIfDbError, UserFacingError } from "@/lib/admin/actions";

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAdminAction(async ({ supabase }) => {
    const deadline = formText(fd, "rsvp_deadline");
    const timeZone = formText(fd, "time_zone");
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new UserFacingError("Choose a valid deadline date.");
    if (!isValidTimeZone(timeZone)) throw new UserFacingError("Enter a time zone like America/New_York.");
    const { error } = await supabase
      .from("wedding_settings")
      .update({ rsvp_deadline: deadline || null, time_zone: timeZone })
      .eq("id", true);
    throwIfDbError(error, "Settings");
    return "Settings saved.";
  });
}
