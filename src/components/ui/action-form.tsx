"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin/action-state";
import { ui } from "@/components/ui/styles";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A form bound to an admin Server Action, with pending state, an optional
 * confirmation prompt, and an inline success/error message.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  pendingLabel = "Saving…",
  confirm,
  variant = "primary",
  resetOnSuccess = false,
  className = "space-y-4",
  inline = false,
}: {
  action: FormAction;
  children?: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  /** If set, the browser asks for confirmation before submitting. */
  confirm?: string;
  variant?: "primary" | "secondary" | "danger";
  resetOnSuccess?: boolean;
  className?: string;
  /** Render the button and message on one line (for small action buttons). */
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const buttonClass = variant === "danger" ? ui.buttonDanger : variant === "secondary" ? ui.buttonSecondary : ui.button;

  return (
    <form
      ref={formRef}
      action={formAction}
      className={inline ? "inline-flex flex-wrap items-center gap-2" : className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      <div className={inline ? "contents" : "flex flex-wrap items-center gap-3"}>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.message && (
          <p role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
