import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createDocumentTypeAction } from "@/app/actions/documents";
import { DOCUMENT_SCOPES } from "@/lib/constants";
import { Badge, Card, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<string, string> = {
  HOME: "The home",
  RESIDENT: "Each resident",
  EMPLOYEE: "Each employee",
};

export default async function DocumentTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireHome();
  const params = await searchParams;

  const types = await prisma.documentType.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { documents: true, ruleChecks: true } } },
  });

  const byCategory = new Map<string, typeof types>();
  for (const type of types) {
    const list = byCategory.get(type.category);
    if (list) list.push(type);
    else byCategory.set(type.category, [type]);
  }

  return (
    <>
      <PageHeader
        title="Document types"
        description="The catalog of records the vault tracks. Add your own for anything your licensor asks for that isn't here."
        action={
          <Link href="/documents" className="btn-secondary">
            Back to vault
          </Link>
        }
      />

      <ErrorBanner message={params.error} />
      {params.saved && <NoticeBanner message="Document type added." />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {[...byCategory.entries()].map(([category, group]) => (
            <Card key={category} title={category}>
              <ul className="divide-y divide-slate-100">
                {group.map((type) => (
                  <li key={type.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{type.name}</span>
                        <Badge tone="slate">{SCOPE_LABELS[type.scope] ?? type.scope}</Badge>
                        {!type.isSystem && <Badge tone="brand">Custom</Badge>}
                        {type.renewalMonths && (
                          <Badge tone="amber">Renews every {type.renewalMonths} mo</Badge>
                        )}
                      </div>
                      {type.description && (
                        <p className="mt-1 text-sm text-slate-600">{type.description}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        {type.wacCite ? `${type.wacCite} · ` : ""}
                        {type._count.documents} filed · {type._count.ruleChecks} check
                        {type._count.ruleChecks === 1 ? "" : "s"} wired
                      </p>
                    </div>
                    <Link href={`/documents?type=${type.id}`} className="btn-secondary btn-sm shrink-0">
                      View filed
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div>
          <Card title="Add a document type">
            <form action={createDocumentTypeAction} className="space-y-4">
              <input type="hidden" name="returnTo" value="/settings/document-types" />

              <div>
                <label className="label" htmlFor="name">
                  Name <span className="text-red-600">*</span>
                </label>
                <input id="name" name="name" required className="input" />
              </div>

              <div>
                <label className="label" htmlFor="scope">
                  Filed under
                </label>
                <select id="scope" name="scope" defaultValue="HOME" className="input">
                  {DOCUMENT_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="category">
                  Category
                </label>
                <input
                  id="category"
                  name="category"
                  placeholder="Custom"
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-500">Used as the binder tab grouping.</p>
              </div>

              <div>
                <label className="label" htmlFor="renewalMonths">
                  Renews every (months)
                </label>
                <input
                  id="renewalMonths"
                  name="renewalMonths"
                  type="number"
                  min={1}
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Leave blank for records that don&apos;t expire.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="wacCite">
                  WAC reference
                </label>
                <input id="wacCite" name="wacCite" placeholder="WAC 388-76-…" className="input" />
              </div>

              <div>
                <label className="label" htmlFor="description">
                  Description
                </label>
                <textarea id="description" name="description" rows={2} className="input" />
              </div>

              <button type="submit" className="btn-primary w-full">
                Add document type
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
