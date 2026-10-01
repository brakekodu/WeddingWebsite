/**
 * Shared plumbing for admin Server Actions.
 *
 * Every admin action runs through runAdminAction, which (1) re-checks admin
 * authorization (actions are public HTTP endpoints), (2) converts expected
 * failures into a message for the form, and (3) refreshes the page on success.
 */
import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { NotAuthorizedError, requireAdmin, type AdminContext } from "@/lib/auth/admin";
import type { ActionState } from "@/lib/admin/action-state";

/** An error whose message is safe and useful to show the admin. */
export class UserFacingError extends Error {}

export async function runAdminAction<T = undefined>(
  fn: (admin: AdminContext) => Promise<{ message?: string; data?: T } | string | void>,
): Promise<ActionState<T>> {
  try {
    const admin = await requireAdmin();
    const result = await fn(admin);
    refresh();
    if (typeof result === "string") return { ok: true, message: result };
    return { ok: true, message: result?.message ?? "Saved.", data: result?.data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof NotAuthorizedError) {
      return { ok: false, message: "Your session has ended or you are not an administrator. Please sign in again." };
    }
    if (error instanceof UserFacingError) return { ok: false, message: error.message };
    console.error("Admin action failed:", error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Throws a UserFacingError for a failed Supabase query, with a readable message. */
export function throwIfDbError(error: PostgrestError | null, context = "That change"): void {
  if (!error) return;
  switch (error.code) {
    case "23505":
      throw new UserFacingError(`${context} conflicts with an existing record.`);
    case "23503":
      throw new UserFacingError(`${context} is blocked because other records depend on it.`);
    case "23514": // check_violation: our triggers raise readable messages
    case "P0001":
    case "42501":
      throw new UserFacingError(error.message);
    default:
      console.error("Database error:", error);
      throw new UserFacingError(`${context} could not be saved.`);
  }
}

// ----- FormData helpers --------------------------------------------------

export function formText(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Empty strings become null, so optional columns are cleared rather than set to "". */
export function formOptional(fd: FormData, name: string): string | null {
  return formText(fd, name) || null;
}

export function formRequired(fd: FormData, name: string, label: string, max = 200): string {
  const value = formText(fd, name);
  if (!value) throw new UserFacingError(`${label} is required.`);
  if (value.length > max) throw new UserFacingError(`${label} must be ${max} characters or fewer.`);
  return value;
}

export function formBool(fd: FormData, name: string): boolean {
  const value = fd.get(name);
  return value === "on" || value === "true" || value === "1";
}

export function formInt(fd: FormData, name: string, fallback = 0): number {
  const value = Number.parseInt(formText(fd, name), 10);
  return Number.isFinite(value) ? value : fallback;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formIds(fd: FormData, name: string): string[] {
  return [...new Set(fd.getAll(name).filter((v): v is string => typeof v === "string" && UUID.test(v)))];
}

export function assertId(value: string, label = "record"): string {
  if (!UUID.test(value)) throw new UserFacingError(`Invalid ${label}.`);
  return value;
}

/** "2027-06-12T16:00" from <input type="datetime-local">, stored as venue-local time. */
export function formLocalDateTime(fd: FormData, name: string): string | null {
  const value = formText(fd, name);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new UserFacingError("Enter dates as date and time.");
  }
  return value;
}
