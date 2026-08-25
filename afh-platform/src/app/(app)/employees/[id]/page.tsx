import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteEmployeeAction, saveEmployeeAction } from "@/app/actions/people";
import { evaluateHome } from "@/lib/compliance/engine";
import { formatDate, toDateInput } from "@/lib/dates";
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  FORM_STATUS_LABELS,
  type DocumentScope,
  type EmployeeRole,
  type FormStatus,
} from "@/lib/constants";
import { DocumentTable, type VaultDocument } from "@/components/DocumentTable";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { FindingsList } from "@/components/FindingsList";
import { Badge, Card, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; uploaded?: string }>;
}) {
  const user = await requireHome();
  const { id } = await params;
  const query = await searchParams;

  const employee = await prisma.employee.findFirst({
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
      formInstances: { include: { template: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!employee) notFound();

  const [documentTypes, report, employeeTemplates] = await Promise.all([
    prisma.documentType.findMany({
      where: { scope: "EMPLOYEE" },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    evaluateHome(user.homeId),
    prisma.formTemplate.findMany({
      where: { subjectType: "EMPLOYEE" },
      orderBy: { title: "asc" },
    }),
  ]);

  const findings = report.findings.filter((f) => f.subjectId === employee.id);
  const open = findings.filter((f) => f.status !== "PASS");
  const returnTo = `/employees/${employee.id}`;

  return (
    <>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={
          <>
            {EMPLOYEE_ROLE_LABELS[employee.role as EmployeeRole] ?? employee.role} · hired{" "}
            {formatDate(employee.hiredAt)}
            {employee.terminatedAt && ` · left ${formatDate(employee.terminatedAt)}`}
          </>
        }
        action={
          <Link href="/employees" className="btn-secondary">
            All employees
          </Link>
        }
      />

      <ErrorBanner message={query.error} />
      {query.saved && <NoticeBanner message="Saved." />}
      {query.uploaded && <NoticeBanner message="Document filed under this employee." />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Requirements for this employee"
            description={
              open.length === 0
                ? "This file is complete."
                : `${open.length} outstanding item${open.length === 1 ? "" : "s"}.`
            }
          >
            {findings.length === 0 ? (
              <p className="text-sm text-slate-500">
                No per-employee rules apply, or your home profile says you don&apos;t employ
                staff.
              </p>
            ) : (
              <FindingsList findings={open.length > 0 ? open : findings} />
            )}
          </Card>

          <Card
            title="Documents on file"
            description={`${employee.documents.length} record${employee.documents.length === 1 ? "" : "s"}.`}
          >
            <DocumentTable
              documents={employee.documents as VaultDocument[]}
              returnTo={returnTo}
              showSubject={false}
            />
          </Card>

          {(employee.formInstances.length > 0 || employeeTemplates.length > 0) && (
            <Card title="Forms">
              {employee.formInstances.length > 0 && (
                <ul className="mb-5 divide-y divide-slate-100">
                  {employee.formInstances.map((instance) => (
                    <li key={instance.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link
                        href={`/forms/instances/${instance.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {instance.template.title}
                      </Link>
                      <Badge tone={instance.status === "COMPLETED" ? "emerald" : "amber"}>
                        {FORM_STATUS_LABELS[instance.status as FormStatus] ?? instance.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {employeeTemplates.map((template) => (
                  <Link
                    key={template.id}
                    href={`/forms/${template.id}/new?employeeId=${employee.id}`}
                    className="btn-secondary btn-sm"
                  >
                    + {template.title}
                  </Link>
                ))}
              </div>
            </Card>
          )}
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
              lockedEmployeeId={employee.id}
            />
          </Card>

          <Card title="Employee details">
            <form action={saveEmployeeAction} className="space-y-4">
              <input type="hidden" name="id" value={employee.id} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    required
                    defaultValue={employee.firstName}
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
                    defaultValue={employee.lastName}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="role">
                  Role
                </label>
                <select id="role" name="role" defaultValue={employee.role} className="input">
                  {EMPLOYEE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {EMPLOYEE_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="hiredAt">
                    Hired
                  </label>
                  <input
                    id="hiredAt"
                    name="hiredAt"
                    type="date"
                    defaultValue={toDateInput(employee.hiredAt)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="terminatedAt">
                    Left
                  </label>
                  <input
                    id="terminatedAt"
                    name="terminatedAt"
                    type="date"
                    defaultValue={toDateInput(employee.terminatedAt)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="credentialNumber">
                    Credential #
                  </label>
                  <input
                    id="credentialNumber"
                    name="credentialNumber"
                    defaultValue={employee.credentialNumber ?? ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    defaultValue={employee.phone ?? ""}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={employee.email ?? ""}
                    className="input"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="hasDirectResidentContact"
                  defaultChecked={employee.hasDirectResidentContact}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Has direct resident contact
              </label>

              <div>
                <label className="label" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={employee.notes ?? ""}
                  className="input"
                />
              </div>

              <button type="submit" className="btn-primary w-full">
                Save changes
              </button>
            </form>

            <form action={deleteEmployeeAction} className="mt-4 border-t border-slate-200 pt-4">
              <input type="hidden" name="id" value={employee.id} />
              <button type="submit" className="btn-danger btn-sm w-full">
                Delete employee and all their documents
              </button>
              <p className="mt-1.5 text-xs text-slate-500">
                Permanent. Set a leaving date instead if you need to keep the file.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
