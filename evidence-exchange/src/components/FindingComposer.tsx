"use client";

import { useActionState, useState } from "react";
import { REQUIREMENT_TOPICS } from "@/lib/wac-catalog";
import { HARM_LABELS, HARM_LEVELS, SCOPES, SCOPE_LABELS } from "@/lib/constants";
import { Alert, buttonClass, Field, inputClass } from "./ui";

type State = { error?: string; ok?: string; blockers?: string[] } | null;

/**
 * Drafting a finding. Picking a topic fills the requirement text, but both the
 * citation and the requirement stay editable — the catalog is a convenience,
 * never an authority, and the banner says so.
 */
export function FindingComposer({
  action,
  inspectionId,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  inspectionId: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);
  const [cite, setCite] = useState("");
  const [requirement, setRequirement] = useState("");

  function pickTopic(value: string) {
    const topic = REQUIREMENT_TOPICS.find((t) => t.cite === value);
    if (!topic) return;
    setCite(topic.cite);
    setRequirement(topic.summary);
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="inspectionId" value={inspectionId} />

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

      <Field label="Start from a requirement topic" hint="Optional shortcut — everything stays editable.">
        <select className={inputClass} defaultValue="" onChange={(e) => pickTopic(e.target.value)}>
          <option value="">Type the citation myself…</option>
          {REQUIREMENT_TOPICS.map((t) => (
            <option key={t.cite} value={t.cite}>
              {t.cite} — {t.topic}
            </option>
          ))}
        </select>
      </Field>

      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        The starter list is a drafting convenience seeded for demonstration and is not verified rule text.
        Confirm the citation and the requirement language against the official chapter before issuing.
      </p>

      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <Field label="Citation" required>
          <input
            className={inputClass}
            name="wacCite"
            value={cite}
            onChange={(e) => setCite(e.target.value)}
            placeholder="WAC 388-76-…"
            required
          />
        </Field>
        <Field label="What the rule requires" required>
          <input
            className={inputClass}
            name="requirementText"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field
        label="What was found"
        hint="The failed provider practice, in the words that will appear on the statement of deficiencies."
        required
      >
        <textarea className={inputClass} name="practiceText" rows={3} required />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Scope">
          <select className={inputClass} name="scope" defaultValue="ISOLATED">
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Harm">
          <select className={inputClass} name="harm" defaultValue="POTENTIAL_HARM">
            {HARM_LEVELS.map((h) => (
              <option key={h} value={h}>
                {HARM_LABELS[h]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="What do you need from the provider?"
        hint="Optional. Creates the first document request on this finding."
      >
        <textarea className={inputClass} name="prompt" rows={2} />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Adding…" : "Add finding"}
      </button>
    </form>
  );
}
