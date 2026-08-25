import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createInspection } from "@/app/actions/inspections";
import { INSPECTION_TYPES, INSPECTION_TYPE_LABELS } from "@/lib/constants";
import { toDateInput } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";
import { Card, CardBody, CardHeader, Field, inputClass, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage() {
  await requireAgency();
  const homes = await prisma.licensedHome.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        eyebrow="Inspections"
        title="Open an inspection"
        description="Start the record now; findings, evidence, and determinations all attach to it."
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader title="Inspection details" />
          <CardBody>
            <ActionForm action={createInspection} submitLabel="Open inspection">
              <Field label="Licensed home" required>
                <select className={inputClass} name="homeId" required defaultValue="">
                  <option value="" disabled>
                    Choose a home…
                  </option>
                  {homes.map((home) => (
                    <option key={home.id} value={home.id}>
                      {home.name} — {home.licenseNumber}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Type" required>
                <select className={inputClass} name="type" defaultValue="FULL">
                  {INSPECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INSPECTION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Survey number" hint="The agency's own reference, printed on the statement.">
                <input className={inputClass} name="surveyNumber" placeholder="2026-K2-00432" />
              </Field>

              <Field label="Date entered">
                <input className={inputClass} type="date" name="enteredAt" defaultValue={toDateInput(new Date())} />
              </Field>

              <Field label="Scope" hint="What the inspection covers: sample sizes, what was observed.">
                <textarea className={inputClass} name="scopeNote" rows={3} />
              </Field>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
