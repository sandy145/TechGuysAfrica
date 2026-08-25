"use client";

import { useActionState, useRef, useState } from "react";
import { Alert, buttonClass, Field, inputClass } from "./ui";

type State = { error?: string; ok?: string; blockers?: string[] } | null;

/**
 * The upload. Deliberately blunt about what happens next: the provider is told
 * the files are attached to this finding, that a receipt is issued, and that
 * they will be able to see when the licensor opens each one. That visibility
 * is the thing an email thread cannot give them.
 */
export function EvidenceUploadForm({
  action,
  findingId,
  requests,
  isLate,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  findingId: string;
  requests: { id: string; prompt: string }[];
  isLate: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);
  const [names, setNames] = useState<string[]>([]);
  const ref = useRef<HTMLFormElement>(null);

  if (state?.ok && names.length > 0) setNames([]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="findingId" value={findingId} />

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

      {isLate ? (
        <Alert tone="warn" title="The deadline has passed">
          You can still upload. The submission is recorded as late and is still put in front of your
          licensor — late documents are kept, not discarded.
        </Alert>
      ) : null}

      {requests.length > 0 ? (
        <Field label="Which request does this answer?">
          <select className={inputClass} name="evidenceRequestId" defaultValue={requests[0].id}>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.prompt.slice(0, 90)}
                {r.prompt.length > 90 ? "…" : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field
        label="Documents"
        hint="PDF, photographs, or office files, up to 25 MB each. You can select several at once."
      >
        <input
          className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-gov-700 file:px-3 file:py-1.5 file:text-white`}
          type="file"
          name="files"
          multiple
          onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))}
        />
      </Field>

      {names.length > 0 ? (
        <ul className="list-disc pl-5 text-xs text-ink-soft">
          {names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <Field
        label="Explain what you are sending"
        hint="What the document shows, and where it was during the inspection if it was not produced then."
      >
        <textarea className={inputClass} name="note" rows={3} />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Uploading…" : "Submit to my licensor"}
      </button>
      <p className="text-xs text-ink-soft">
        You will get a receipt listing every file, and this page will show you when your licensor opens each
        one.
      </p>
    </form>
  );
}
