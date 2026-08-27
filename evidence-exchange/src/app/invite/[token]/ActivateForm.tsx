"use client";

import { useActionState } from "react";
import { activateInvite, type FormState } from "@/app/actions/auth";
import { Alert, Field, inputClass, SubmitButton } from "@/components/ui";

export function ActivateForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(activateInvite, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Password" hint="At least 10 characters." required>
        <input className={inputClass} type="password" name="password" autoComplete="new-password" required />
      </Field>

      <Field label="Confirm password" required>
        <input className={inputClass} type="password" name="confirm" autoComplete="new-password" required />
      </Field>

      <SubmitButton disabled={pending} className="w-full">
        {pending ? "Activating…" : "Activate account"}
      </SubmitButton>
    </form>
  );
}
