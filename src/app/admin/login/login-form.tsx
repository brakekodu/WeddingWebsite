"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { ui } from "@/components/ui/styles";
import { signIn } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, null);
  return (
    <form action={formAction} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block">
        <span className={ui.label}>Email</span>
        <input
          // Re-mount with the submitted email so a failed attempt keeps it filled in.
          key={state?.email ?? ""}
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state?.email ?? ""}
          className={ui.input}
        />
      </label>
      <label className="block">
        <span className={ui.label}>Password</span>
        <PasswordInput name="password" autoComplete="current-password" className={ui.input} />
      </label>
      <button type="submit" className={`${ui.button} w-full`} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
