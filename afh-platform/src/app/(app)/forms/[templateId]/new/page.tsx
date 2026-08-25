import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createFormInstanceAction } from "@/app/actions/forms";
import { templateFields, templateSigners } from "@/lib/forms/instance";
import { toDateInput } from "@/lib/dates";
import { DynamicFormFields } from "@/components/DynamicFormFields";
import { Card, ErrorBanner, PageHeader, WacCite } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ residentId?: string; employeeId?: string; error?: string }>;
}) {
  const user = await requireHome();
  const { templateId } = await params;
  const query = await searchParams;

  const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
  if (!template) notFound();

  const [residents, employees] = await Promise.all([
    template.subjectType === "RESIDENT"
      ? prisma.resident.findMany({
          where: { homeId: user.homeId, dischargedAt: null },
          orderBy: [{ lastName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    template.subjectType === "EMPLOYEE"
      ? prisma.employee.findMany({
          where: { homeId: user.homeId, terminatedAt: null },
          orderBy: [{ lastName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
  ]);

  const fields = templateFields(template);
  const signers = templateSigners(template);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={template.title}
        description={template.description}
        action={
          <Link href="/forms" className="btn-secondary">
            All forms
          </Link>
        }
      />

      <ErrorBanner message={query.error} />

      {template.wacCite && (
        <p className="mb-4">
          <WacCite cite={template.wacCite} verified={false} />
        </p>
      )}

      <Card>
        <form action={createFormInstanceAction} className="space-y-6">
          <input type="hidden" name="templateId" value={template.id} />

          {template.subjectType === "RESIDENT" && (
            <div>
              <label className="label" htmlFor="residentId">
                Resident this form is about <span className="text-red-600">*</span>
              </label>
              <select
                id="residentId"
                name="residentId"
                required
                defaultValue={query.residentId ?? ""}
                className="input"
              >
                <option value="">Select a resident…</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.firstName} {r.lastName}
                  </option>
                ))}
              </select>
              {residents.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Add a resident first —{" "}
                  <Link href="/residents" className="underline">
                    go to residents
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          {template.subjectType === "EMPLOYEE" && (
            <div>
              <label className="label" htmlFor="employeeId">
                Employee this form is about <span className="text-red-600">*</span>
              </label>
              <select
                id="employeeId"
                name="employeeId"
                required
                defaultValue={query.employeeId ?? ""}
                className="input"
              >
                <option value="">Select an employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="effectiveAt">
              Effective date
            </label>
            <input
              id="effectiveAt"
              name="effectiveAt"
              type="date"
              defaultValue={toDateInput(new Date())}
              className="input sm:max-w-xs"
            />
          </div>

          <DynamicFormFields fields={fields} />

          {signers.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">
                Signatures needed once this is filled in
              </p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-slate-600">
                {signers.map((signer) => (
                  <li key={signer.key}>
                    · {signer.label}
                    {signer.remote && " (signs by private link)"}
                    {signer.required === false && " — optional"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" className="btn-primary">
            Create form
          </button>
        </form>
      </Card>
    </div>
  );
}
