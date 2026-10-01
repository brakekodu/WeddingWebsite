"use client";

import { useActionState } from "react";
import { s } from "@/components/site/styles";
import { lookupRsvpCode } from "./actions";

/** Component 16: code input. */
export function RsvpCodeForm() {
  const [state, formAction, pending] = useActionState(lookupRsvpCode, null);
  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="rsvp-code" className="block font-semibold">
        RSVP code
      </label>
      <input
        id="rsvp-code"
        name="code"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        aria-invalid={state?.error ? true : undefined}
        aria-describedby="rsvp-code-hint"
        className={`${s.input} text-center font-mono text-2xl tracking-[0.3em] uppercase ${state?.error ? "border-error" : ""}`}
      />
      <p id="rsvp-code-hint" className="text-sm text-muted">
        Not case-sensitive.
      </p>
      {state?.error && (
        <p role="alert" className={s.error}>
          <span aria-hidden>! </span>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${s.btn} w-full`}>
        {pending ? "Finding…" : "Find my invitation"}
      </button>
    </form>
  );
}
