import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveResidentAction } from "@/app/actions/people";
import { formatDate } from "@/lib/dates";
import { Badge, Card, EmptyState, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; showDischarged?: string }>;
}) {
  const user = await requireHome();
  const params = await searchParams;
  const showDischarged = params.showDischarged === "1";

  const residents = await prisma.resident.findMany({
    where: { homeId: user.homeId, ...(showDischarged ? {} : { dischargedAt: null }) },
    orderBy: [{ dischargedAt: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: { _count: { select: { documents: true } } },
  });

  return (
    <>
      <PageHeader
        title="Residents"
        description="Each resident carries their own file. Adding one turns on the per-resident requirements in your compliance check."
        action={
          <Link
            href={showDischarged ? "/residents" : "/residents?showDischarged=1"}
            className="btn-secondary"
          >
            {showDischarged ? "Hide discharged" : "Show discharged"}
          </Link>
        }
      />

      <ErrorBanner message={params.error} />
      {params.saved && <NoticeBanner message="Resident saved." />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Current residents" description={`${residents.length} on file.`}>
            {residents.length === 0 ? (
              <EmptyState
                title="No residents yet"
                description="Add your first resident to start tracking negotiated care plans, assessments, and the rest of the resident record."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {residents.map((resident) => (
                  <li key={resident.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link
                        href={`/residents/${resident.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {resident.firstName} {resident.lastName}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Admitted {formatDate(resident.admittedAt)} ·{" "}
                        {resident._count.documents} document
                        {resident._count.documents === 1 ? "" : "s"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {resident.dischargedAt && (
                          <Badge tone="slate">
                            Discharged {formatDate(resident.dischargedAt)}
                          </Badge>
                        )}
                        {resident.hasDementiaDiagnosis && <Badge tone="brand">Dementia</Badge>}
                        {resident.hasMentalHealthDiagnosis && (
                          <Badge tone="brand">Mental health</Badge>
                        )}
                        {resident.hasDevelopmentalDisability && (
                          <Badge tone="brand">Developmental disability</Badge>
                        )}
                        {resident.isMedicaid && <Badge tone="slate">Medicaid</Badge>}
                        {resident.selfAdministersMedication && (
                          <Badge tone="slate">Self-administers meds</Badge>
                        )}
                      </div>
                    </div>
                    <Link href={`/residents/${resident.id}`} className="btn-secondary btn-sm">
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
            title="Add a resident"
            description="The diagnosis flags decide which specialty requirements apply."
          >
            <ResidentFields />
          </Card>
        </div>
      </div>
    </>
  );
}

function ResidentFields() {
  return (
    <form action={saveResidentAction} className="space-y-4">
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
        <div>
          <label className="label" htmlFor="dateOfBirth">
            Date of birth
          </label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="admittedAt">
            Admitted
          </label>
          <input id="admittedAt" name="admittedAt" type="date" className="input" />
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="label">Applies to this resident</legend>
        {[
          { name: "hasDementiaDiagnosis", label: "Dementia diagnosis" },
          { name: "hasMentalHealthDiagnosis", label: "Mental health diagnosis" },
          { name: "hasDevelopmentalDisability", label: "Developmental disability" },
          { name: "isMedicaid", label: "Medicaid client" },
          { name: "selfAdministersMedication", label: "Self-administers medication" },
        ].map((flag) => (
          <label key={flag.name} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name={flag.name}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {flag.label}
          </label>
        ))}
      </fieldset>

      <button type="submit" className="btn-primary w-full">
        Add resident
      </button>
    </form>
  );
}
