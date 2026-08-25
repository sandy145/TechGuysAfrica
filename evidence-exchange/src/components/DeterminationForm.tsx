"use client";

import { useActionState, useState } from "react";
import { Alert, buttonClass, Field, inputClass } from "./ui";
import { OUTCOME_DESCRIPTIONS, OUTCOME_LABELS, type Outcome } from "@/lib/constants";

type State = { error?: string; ok?: string; blockers?: string[] } | null;

/**
 * The decision screen.
 *
 * The gate has already been evaluated on the server for the currently selected
 * outcome; what this component adds is that the consequences are visible
 * *before* the click. Choosing "Citation" while evidence sits unreviewed
 * greys out the button and says why, so the decision-maker is never surprised
 * by the refusal — and is nudged to go and read the document instead.
 */
export function DeterminationForm({
  action,
  findingId,
  citationBlockers,
  overridable,
  notices,
  canOverride,
  suggestedRationale,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  findingId: string;
  citationBlockers: string[];
  overridable: string[];
  notices: string[];
  canOverride: boolean;
  suggestedRationale: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);
  const [outcome, setOutcome] = useState<Outcome | "">("");

  const blocked = outcome === "CITATION" && citationBlockers.length > 0;
  const needsOverride = outcome === "CITATION" && overridable.length > 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="findingId" value={findingId} />

      {state?.blockers?.length ? (
        <Alert tone="danger" title="This determination was not recorded">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Outcome</legend>
        {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((value) => (
          <label
            key={value}
            className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
              outcome === value ? "border-gov-500 bg-gov-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="outcome"
              value={value}
              className="mt-1"
              checked={outcome === value}
              onChange={() => setOutcome(value)}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{OUTCOME_LABELS[value]}</span>
              <span className="block text-xs text-ink-soft">{OUTCOME_DESCRIPTIONS[value]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {blocked ? (
        <Alert tone="danger" title="A citation cannot be recorded on this finding yet">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {citationBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {needsOverride ? (
        <Alert tone="warn" title="Below the evidence standard">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {overridable.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {canOverride ? (
            <div className="mt-3">
              <Field label="Supervisor override reason" required>
                <textarea
                  className={inputClass}
                  name="overrideReason"
                  rows={2}
                  placeholder="Why this proceeds despite the item above. Printed on the statement of deficiencies."
                />
              </Field>
            </div>
          ) : (
            <p className="mt-2 text-sm">
              A supervisor has to record the override. Add the missing source, or ask your field manager
              to record the determination.
            </p>
          )}
        </Alert>
      ) : null}

      {notices.length > 0 ? (
        <Alert tone="info" title="For the record">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Field
        label="Rationale"
        hint="What the evidence showed and why it leads here. The provider reads this; so does anyone reviewing the decision later."
        required
      >
        <textarea
          className={inputClass}
          name="rationale"
          rows={5}
          defaultValue={suggestedRationale}
          required
        />
      </Field>

      <button
        type="submit"
        disabled={pending || blocked || (needsOverride && !canOverride)}
        className={buttonClass(outcome === "CITATION" ? "danger" : "primary")}
      >
        {pending ? "Recording…" : outcome ? `Record ${OUTCOME_LABELS[outcome].toLowerCase()}` : "Record determination"}
      </button>
    </form>
  );
}
