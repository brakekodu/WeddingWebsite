"use client";

import { useActionState } from "react";
import { ui } from "@/components/ui/styles";
import type { ActionState } from "@/lib/admin/action-state";
import type { QrValidationResult } from "@/lib/invitations/validation";

type QrAction = (state: ActionState<QrValidationResult>, fd: FormData) => Promise<ActionState<QrValidationResult>>;

/** "Test QR" (dry run) and "Validate QR" (saved), with an itemized result. */
export function QrTools({ action }: { action: QrAction }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap gap-2">
        <button name="mode" value="test" className={ui.buttonSecondary} disabled={pending}>
          Test QR
        </button>
        <button name="mode" value="validate" className={ui.button} disabled={pending}>
          {pending ? "Checking…" : "Validate QR"}
        </button>
      </form>
      {state && (
        <div className="rounded-md border border-stone-200 p-3 text-sm">
          <p className={state.ok && state.data?.status === "passed" ? "text-emerald-700" : "text-red-700"}>
            {state.message}
          </p>
          {state.data && <ValidationChecks result={state.data} />}
        </div>
      )}
    </div>
  );
}

export function ValidationChecks({ result }: { result: QrValidationResult }) {
  return (
    <div className="mt-2 space-y-1">
      <ul className="space-y-1">
        {result.checks.map((check) => (
          <li key={check.id} className="flex gap-2">
            <span aria-hidden className={check.passed ? "text-emerald-600" : "text-red-600"}>
              {check.passed ? "✓" : "✗"}
            </span>
            <span>
              {check.label}
              {check.detail && <span className="block text-xs break-all text-stone-500">{check.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs break-all text-stone-500">Decoded: {result.decodedUrl ?? "—"}</p>
      {result.provisionalBaseUrl && (
        <p className="text-xs text-amber-800">Base URL is provisional — valid for proofs only.</p>
      )}
    </div>
  );
}
