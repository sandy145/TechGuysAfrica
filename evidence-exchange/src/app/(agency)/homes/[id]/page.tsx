import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteProviderContact } from "@/app/actions/people";
import { rollupFindings } from "@/lib/queries";
import { formatDate } from "@/lib/dates";
import { INSPECTION_STATUS_LABELS, INSPECTION_TYPE_LABELS } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Detail,
  Field,
  inputClass,
  PageHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAgency();

  const home = await prisma.licensedHome.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      inspections: {
        include: { findings: { include: { submissions: { include: { files: true } }, determination: true } } },
        orderBy: { enteredAt: "desc" },
      },
    },
  });
  if (!home) notFound();

  const specialties: string[] = JSON.parse(home.specialties);

  return (
    <>
      <PageHeader
        eyebrow={`Licence ${home.licenseNumber}`}
        title={home.name}
        description={`${home.addressLine1 ?? ""} ${home.city ?? ""} ${home.zip ?? ""} · licensee ${home.providerName}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Inspection history" />
            <CardBody className="p-0">
              {home.inspections.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">No inspections recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {home.inspections.map((inspection) => {
                    const roll = rollupFindings(inspection.findings);
                    return (
                      <li key={inspection.id}>
                        <Link href={`/inspections/${inspection.id}`} className="block px-5 py-3 hover:bg-slate-50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-ink">
                              {INSPECTION_TYPE_LABELS[inspection.type as keyof typeof INSPECTION_TYPE_LABELS]} ·{" "}
                              {inspection.surveyNumber ?? "—"}
                            </p>
                            <Badge tone={inspection.status === "CLOSED" ? "neutral" : "info"}>
                              {INSPECTION_STATUS_LABELS[inspection.status as keyof typeof INSPECTION_STATUS_LABELS]}
                            </Badge>
                          </div>
                          <p className="text-xs text-ink-soft">
                            Entered {formatDate(inspection.enteredAt)} · {roll.total} finding(s) · {roll.cited}{" "}
                            cited
                            {roll.unreviewedSubmissions > 0 ? (
                              <span className="ml-2 font-semibold text-red-700">
                                {roll.unreviewedSubmissions} unreviewed
                              </span>
                            ) : null}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Home record" />
            <CardBody>
              <dl>
                <Detail label="Licensee">{home.providerName}</Detail>
                <Detail label="Capacity">{home.bedCapacity} beds · {home.residentCount} residents</Detail>
                <Detail label="Specialties">
                  {specialties.length ? specialties.join(", ").replaceAll("_", " ").toLowerCase() : "None"}
                </Detail>
                <Detail label="Licensed since">{formatDate(home.licensedAt)}</Detail>
                <Detail label="Contact">{home.phone ?? "—"} · {home.email ?? "—"}</Detail>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Portal access"
              subtitle="Who can see findings and upload documents for this home."
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-slate-200">
                {home.contacts.map((contact) => (
                  <li key={contact.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-ink">{contact.name}</p>
                    <p className="text-xs text-ink-soft">{contact.email}</p>
                    {contact.passwordHash ? (
                      <Badge tone="ok">Active · last sign-in {formatDate(contact.lastLoginAt)}</Badge>
                    ) : (
                      <Badge tone="warn">
                        Invited {formatDate(contact.createdAt)} · not yet activated
                      </Badge>
                    )}
                  </li>
                ))}
                {home.contacts.length === 0 ? (
                  <li className="px-5 py-3 text-sm text-ink-soft">No contacts yet.</li>
                ) : null}
              </ul>
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <ActionForm action={inviteProviderContact} submitLabel="Send invitation" size="sm" resetOnSuccess>
                  <input type="hidden" name="homeId" value={home.id} />
                  <Field label="Name" required>
                    <input className={inputClass} name="name" required />
                  </Field>
                  <Field label="Email" required>
                    <input className={inputClass} name="email" type="email" required />
                  </Field>
                  <Field label="Role at the home">
                    <input className={inputClass} name="title" placeholder="Provider / resident manager" />
                  </Field>
                </ActionForm>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
