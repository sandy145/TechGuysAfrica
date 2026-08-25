import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveEmployeeAction } from "@/app/actions/people";
import { formatDate } from "@/lib/dates";
import { EMPLOYEE_ROLES, EMPLOYEE_ROLE_LABELS, type EmployeeRole } from "@/lib/constants";
import { Badge, Card, EmptyState, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; showFormer?: string }>;
}) {
  const user = await requireHome();
  const params = await searchParams;
  const showFormer = params.showFormer === "1";

  const employees = await prisma.employee.findMany({
    where: { homeId: user.homeId, ...(showFormer ? {} : { terminatedAt: null }) },
    orderBy: [{ terminatedAt: "asc" }, { lastName: "asc" }],
    include: { _count: { select: { documents: true } } },
  });

  return (
    <>
      <PageHeader
        title="Employees"
        description="Caregivers, substitutes, volunteers, and contractors. Each one gets their own file of background checks, training, and health records."
        action={
          <Link
            href={showFormer ? "/employees" : "/employees?showFormer=1"}
            className="btn-secondary"
          >
            {showFormer ? "Hide former staff" : "Show former staff"}
          </Link>
        }
      />

      <ErrorBanner message={params.error} />
      {params.saved && <NoticeBanner message="Employee saved." />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Staff" description={`${employees.length} on file.`}>
            {employees.length === 0 ? (
              <EmptyState
                title="No employees yet"
                description="If you employ caregivers, add them here so their background checks, training, and TB screening get tracked."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <li key={employee.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link
                        href={`/employees/${employee.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {employee.firstName} {employee.lastName}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {EMPLOYEE_ROLE_LABELS[employee.role as EmployeeRole] ?? employee.role} ·
                        hired {formatDate(employee.hiredAt)} · {employee._count.documents} document
                        {employee._count.documents === 1 ? "" : "s"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {employee.terminatedAt && (
                          <Badge tone="slate">
                            Left {formatDate(employee.terminatedAt)}
                          </Badge>
                        )}
                        {!employee.hasDirectResidentContact && (
                          <Badge tone="slate">No direct resident contact</Badge>
                        )}
                        {employee.credentialNumber && (
                          <Badge tone="brand">Credential {employee.credentialNumber}</Badge>
                        )}
                      </div>
                    </div>
                    <Link href={`/employees/${employee.id}`} className="btn-secondary btn-sm">
                      Open file
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card
            title="Add an employee"
            description="Role and contact type decide which staff requirements apply."
          >
            <form action={saveEmployeeAction} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="firstName">
                    First name <span className="text-red-600">*</span>
                  </label>
                  <input id="firstName" name="firstName" required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">
                    Last name <span className="text-red-600">*</span>
                  </label>
                  <input id="lastName" name="lastName" required className="input" />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="role">
                  Role
                </label>
                <select id="role" name="role" defaultValue="CAREGIVER" className="input">
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
                  <input id="hiredAt" name="hiredAt" type="date" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="credentialNumber">
                    Credential #
                  </label>
                  <input id="credentialNumber" name="credentialNumber" className="input" />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input id="email" name="email" type="email" className="input" />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="hasDirectResidentContact"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Has direct resident contact
              </label>

              <button type="submit" className="btn-primary w-full">
                Add employee
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
