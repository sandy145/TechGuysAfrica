import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { FORM_STATUS_LABELS, type FormStatus } from "@/lib/constants";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, WacCite } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireHome();
  const { error } = await searchParams;

  const [templates, instances] = await Promise.all([
    prisma.formTemplate.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }] }),
    prisma.formInstance.findMany({
      where: { homeId: user.homeId },
      include: {
        template: true,
        resident: { select: { firstName: true, lastName: true } },
        employee: { select: { firstName: true, lastName: true } },
        signatures: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  const byCategory = new Map<string, typeof templates>();
  for (const template of templates) {
    const list = byCategory.get(template.category);
    if (list) list.push(template);
    else byCategory.set(template.category, [template]);
  }

  return (
    <>
      <PageHeader
        title="Forms"
        description="Fill a form once, sign it on screen or send a private link to whoever else has to sign, and the completed copy files itself into the right record."
      />

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {[...byCategory.entries()].map(([category, group]) => (
            <Card key={category} title={category}>
              <ul className="divide-y divide-slate-100">
                {group.map((template) => (
                  <li key={template.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{template.title}</p>
                      {template.description && (
                        <p className="mt-0.5 text-sm text-slate-600">{template.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <WacCite cite={template.wacCite} verified={false} />
                        <Badge tone="slate">
                          {template.subjectType === "RESIDENT"
                            ? "Per resident"
                            : template.subjectType === "EMPLOYEE"
                              ? "Per employee"
                              : "Whole home"}
                        </Badge>
                      </div>
                    </div>
                    <Link href={`/forms/${template.id}/new`} className="btn-primary btn-sm shrink-0">
                      Start
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          {templates.length === 0 && (
            <Card title="Forms">
              <EmptyState
                title="No form templates loaded"
                description="Run `npm run db:seed` to load the starter templates."
              />
            </Card>
          )}
        </div>

        <div>
          <Card title="Recent forms" description="Drafts, pending signatures, and completed.">
            {instances.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {instances.map((instance) => {
                  const signed = instance.signatures.filter((s) => s.signedAt).length;
                  const subject =
                    instance.resident
                      ? `${instance.resident.firstName} ${instance.resident.lastName}`
                      : instance.employee
                        ? `${instance.employee.firstName} ${instance.employee.lastName}`
                        : "The home";

                  return (
                    <li key={instance.id} className="py-3">
                      <Link
                        href={`/forms/instances/${instance.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {instance.template.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {subject} · {formatDate(instance.updatedAt)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge
                          tone={
                            instance.status === "COMPLETED"
                              ? "emerald"
                              : instance.status === "AWAITING_SIGNATURES"
                                ? "amber"
                                : instance.status === "VOIDED"
                                  ? "red"
                                  : "slate"
                          }
                        >
                          {FORM_STATUS_LABELS[instance.status as FormStatus] ?? instance.status}
                        </Badge>
                        {instance.signatures.length > 0 && (
                          <span className="text-xs text-slate-500">
                            {signed}/{instance.signatures.length} signed
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
