"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/app/actions/auth";
import { Alert, Field, inputClass, SubmitButton } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Email" required>
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="username"
          required
          autoFocus
        />
      </Field>

      <Field label="Password" required>
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </SubmitButton>
    </form>
  );
}
