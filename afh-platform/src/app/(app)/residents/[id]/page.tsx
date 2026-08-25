import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteResidentAction, saveResidentAction } from "@/app/actions/people";
import { evaluateHome } from "@/lib/compliance/engine";
import { formatDate, toDateInput } from "@/lib/dates";
import { FORM_STATUS_LABELS, type FormStatus } from "@/lib/constants";
import { DocumentTable, type VaultDocument } from "@/components/DocumentTable";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { FindingsList } from "@/components/FindingsList";
import { Badge, Card, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";
import type { DocumentScope } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ResidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; uploaded?: string; deleted?: string }>;
}) {
  const user = await requireHome();
  const { id } = await params;
  const query = await searchParams;

  const resident = await prisma.resident.findFirst({
    where: { id, homeId: user.homeId },
    include: {
      documents: {
        include: {
          documentType: true,
          resident: { select: { id: true, firstName: true, lastName: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      formInstances: {
        include: { template: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!resident) notFound();

  const [documentTypes, report, residentTemplates] = await Promise.all([
    prisma.documentType.findMany({
      where: { scope: "RESIDENT" },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    evaluateHome(user.homeId),
    prisma.formTemplate.findMany({
      where: { subjectType: "RESIDENT" },
      orderBy: { title: "asc" },
    }),
  ]);

  const findings = report.findings.filter((f) => f.subjectId === resident.id);
  const open = findings.filter((f) => f.status !== "PASS");
  const returnTo = `/residents/${resident.id}`;

  return (
    <>
      <PageHeader
        title={`${resident.firstName} ${resident.lastName}`}
        description={
          <>
            Admitted {formatDate(resident.admittedAt)}
            {resident.dischargedAt && ` · discharged ${formatDate(resident.dischargedAt)}`}
          </>
        }
        action={
          <Link href="/residents" className="btn-secondary">
            All residents
          </Link>
        }
      />

      <ErrorBanner message={query.error} />
      {query.saved && <NoticeBanner message="Saved." />}
      {query.uploaded && <NoticeBanner message="Document filed under this resident." />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Requirements for this resident"
            description={
              open.length === 0
                ? "This file is complete."
                : `${open.length} outstanding item${open.length === 1 ? "" : "s"}.`
            }
          >
            {findings.length === 0 ? (
              <p className="text-sm text-slate-500">
                No per-resident rules are configured yet.
              </p>
            ) : (
              <FindingsList findings={open.length > 0 ? open : findings} />
            )}
          </Card>

          <Card
            title="Documents on file"
            description={`${resident.documents.length} record${resident.documents.length === 1 ? "" : "s"}.`}
          >
            <DocumentTable
              documents={resident.documents as VaultDocument[]}
              returnTo={returnTo}
              showSubject={false}
            />
          </Card>

          <Card
            title="Forms"
            description="Generate a form for this resident, sign it, and it files itself here."
          >
            {resident.formInstances.length > 0 && (
              <ul className="mb-5 divide-y divide-slate-100">
                {resident.formInstances.map((instance) => (
                  <li key={instance.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <Link
                        href={`/forms/instances/${instance.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {instance.template.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {formatDate(instance.createdAt)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        instance.status === "COMPLETED"
                          ? "emerald"
                          : instance.status === "AWAITING_SIGNATURES"
                            ? "amber"
                            : "slate"
                      }
                    >
                      {FORM_STATUS_LABELS[instance.status as FormStatus] ?? instance.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              {residentTemplates.map((template) => (
                <Link
                  key={template.id}
                  href={`/forms/${template.id}/new?residentId=${resident.id}`}
                  className="btn-secondary btn-sm"
                >
                  + {template.title}
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Upload to this file">
            <DocumentUploadForm
              documentTypes={documentTypes.map((t) => ({
                id: t.id,
                name: t.name,
                scope: t.scope as DocumentScope,
                category: t.category,
                renewalMonths: t.renewalMonths,
                description: t.description,
              }))}
              residents={[]}
              employees={[]}
              returnTo={returnTo}
              lockedResidentId={resident.id}
            />
          </Card>

          <Card title="Resident details">
            <form action={saveResidentAction} className="space-y-4">
              <input type="hidden" name="id" value={resident.id} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    required
                    defaultValue={resident.firstName}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    required
                    defaultValue={resident.lastName}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="dateOfBirth">
                    Date of birth
                  </label>
                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    defaultValue={toDateInput(resident.dateOfBirth)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="admittedAt">
                    Admitted
                  </label>
                  <input
                    id="admittedAt"
                    name="admittedAt"
                    type="date"
                    defaultValue={toDateInput(resident.admittedAt)}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="dischargedAt">
                    Discharged
                  </label>
                  <input
                    id="dischargedAt"
                    name="dischargedAt"
                    type="date"
                    defaultValue={toDateInput(resident.dischargedAt)}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Setting this stops the resident counting toward active requirements.
                  </p>
                </div>
              </div>

              <fieldset className="space-y-1.5">
                <legend className="label">Applies to this resident</legend>
                {[
                  { name: "hasDementiaDiagnosis", label: "Dementia diagnosis", checked: resident.hasDementiaDiagnosis },
                  { name: "hasMentalHealthDiagnosis", label: "Mental health diagnosis", checked: resident.hasMentalHealthDiagnosis },
                  { name: "hasDevelopmentalDisability", label: "Developmental disability", checked: resident.hasDevelopmentalDisability },
                  { name: "isMedicaid", label: "Medicaid client", checked: resident.isMedicaid },
                  { name: "selfAdministersMedication", label: "Self-administers medication", checked: resident.selfAdministersMedication },
                ].map((flag) => (
                  <label key={flag.name} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name={flag.name}
                      defaultChecked={flag.checked}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {flag.label}
                  </label>
                ))}
              </fieldset>

              <div>
                <label className="label" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={resident.notes ?? ""}
                  className="input"
                />
              </div>

              <button type="submit" className="btn-primary w-full">
                Save changes
              </button>
            </form>

            <form action={deleteResidentAction} className="mt-4 border-t border-slate-200 pt-4">
              <input type="hidden" name="id" value={resident.id} />
              <button type="submit" className="btn-danger btn-sm w-full">
                Delete resident and all their documents
              </button>
              <p className="mt-1.5 text-xs text-slate-500">
                Permanent. Discharge the resident instead if you need to keep the file.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
