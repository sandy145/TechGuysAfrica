import Link from "next/link";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLicensedHome } from "@/app/actions/people";
import { formatDate } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, CardBody, CardHeader, Field, inputClass, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomesPage() {
  await requireAgency();
  const homes = await prisma.licensedHome.findMany({
    include: {
      contacts: true,
      inspections: { orderBy: { enteredAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Licensed homes"
        title="Homes on file"
        description="The regulated entities this office covers, and who at each one can respond to findings."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-5 py-2 font-medium">Home</th>
                    <th className="px-3 py-2 font-medium">Licensee</th>
                    <th className="px-3 py-2 font-medium">Beds</th>
                    <th className="px-3 py-2 font-medium">Portal access</th>
                    <th className="px-5 py-2 font-medium">Last inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {homes.map((home) => {
                    const active = home.contacts.filter((c) => c.passwordHash).length;
                    return (
                      <tr key={home.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link href={`/homes/${home.id}`} className="font-medium text-gov-700 hover:underline">
                            {home.name}
                          </Link>
                          <p className="text-xs text-ink-soft">
                            {home.licenseNumber} · {home.city}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-soft">{home.providerName}</td>
                        <td className="px-3 py-3 text-xs text-ink-soft">{home.bedCapacity}</td>
                        <td className="px-3 py-3">
                          {home.contacts.length === 0 ? (
                            <Badge tone="warn">No contact</Badge>
                          ) : active === 0 ? (
                            <Badge tone="warn">Invited, not activated</Badge>
                          ) : (
                            <Badge tone="ok">{active} active</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-ink-soft">
                          {home.inspections[0] ? formatDate(home.inspections[0].enteredAt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Add a home" subtitle="For a pilot. A real deployment syncs from the licensing system of record." />
          <CardBody>
            <ActionForm action={createLicensedHome} submitLabel="Add home" size="sm" resetOnSuccess>
              <Field label="Licence number" required>
                <input className={inputClass} name="licenseNumber" required />
              </Field>
              <Field label="Home name" required>
                <input className={inputClass} name="name" required />
              </Field>
              <Field label="Licensee" required>
                <input className={inputClass} name="providerName" required />
              </Field>
              <Field label="Address">
                <input className={inputClass} name="addressLine1" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={inputClass} name="city" />
                </Field>
                <Field label="County">
                  <input className={inputClass} name="county" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input className={inputClass} name="email" type="email" />
                </Field>
                <Field label="Beds">
                  <input className={inputClass} name="bedCapacity" type="number" defaultValue={6} min={1} />
                </Field>
              </div>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
