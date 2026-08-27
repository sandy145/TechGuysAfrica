"use client";

import { useActionState, useRef } from "react";
import { Alert, buttonClass } from "./ui";

type State = { error?: string; ok?: string; blockers?: string[] } | null;

/**
 * One wrapper for every server-action form in the app. It renders the three
 * kinds of answer the server gives back — an error, a list of blockers from a
 * workflow gate, or a confirmation — in the same place every time, so a
 * blocked citation reads the same as a blocked upload.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = "primary",
  size = "md",
  className = "",
  resetOnSuccess = false,
  footer,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  className?: string;
  resetOnSuccess?: boolean;
  footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);

  if (resetOnSuccess && state?.ok && ref.current) ref.current.reset();

  return (
    <form ref={ref} action={formAction} className={`space-y-3 ${className}`}>
      {state?.blockers?.length ? (
        <Alert tone="danger" title="This cannot be recorded yet">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

      {children}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass(variant, size)}>
          {pending ? (pendingLabel ?? "Working…") : submitLabel}
        </button>
        {footer}
      </div>
    </form>
  );
}
