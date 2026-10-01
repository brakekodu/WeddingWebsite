"use client";

import { useActionState } from "react";
import { lookupRsvpCode } from "./actions";

export function RsvpCodeForm() {
  const [state, formAction, pending] = useActionState(lookupRsvpCode, null);
  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="sr-only">RSVP code</span>
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          placeholder="ABCD-2345"
          className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.2em] text-stone-900 uppercase focus:border-stone-700 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-stone-900 px-8 text-base font-medium text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {pending ? "Looking up…" : "Find my invitation"}
      </button>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
    </form>
  );
}
