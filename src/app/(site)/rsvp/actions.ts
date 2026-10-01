"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CodeLookupState = { error: string } | null;

const resultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), token: z.string() }),
  z.object({ status: z.literal("not_found") }),
  z.object({ status: z.literal("throttled") }),
]);

/** Resolves a printed RSVP code to its invitation and redirects to /i/{token}. */
export async function lookupRsvpCode(_prev: CodeLookupState, formData: FormData): Promise<CodeLookupState> {
  const code = formData.get("code");
  if (typeof code !== "string" || code.trim() === "") return { error: "Please enter your RSVP code." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_rsvp_code", { p_code: code.slice(0, 64) });
  if (error) {
    console.error("resolve_rsvp_code failed:", error.message);
    return { error: "We couldn't look up that code just now. Please try again in a moment." };
  }

  const result = resultSchema.safeParse(data);
  if (!result.success) return { error: "We couldn't look up that code just now. Please try again." };
  if (result.data.status === "throttled") {
    return {
      error: "Too many attempts right now. Please scan the QR code on your invitation, or try again in a few minutes.",
    };
  }
  if (result.data.status === "not_found") {
    return {
      error: "We couldn't find that code. Check letters that look alike (0 and O, 1 and I) and try again.",
    };
  }
  redirect(`/i/${result.data.token}`);
}
