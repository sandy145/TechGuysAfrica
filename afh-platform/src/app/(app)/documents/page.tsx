import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DocumentTable, type VaultDocument } from "@/components/DocumentTable";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { Card, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";
import type { DocumentScope } from "@/lib/constants";

export const dynamic = "force-dynamic";

const SCOPE_TABS: Array<{ key: "ALL" | DocumentScope; label: string }> = [
  { key: "ALL", label: "Everything" },
  { key: "HOME", label: "Home records" },
  { key: "RESIDENT", label: "Resident records" },
  { key: "EMPLOYEE", label: "Employee records" },
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    uploaded?: string;
    deleted?: string;
    saved?: string;
    scope?: string;
    type?: string;
    upload?: string;
  }>;
}) {
  const user = await requireHome();
  const params = await searchParams;

  const scope = SCOPE_TABS.some((t) => t.key === params.scope)
    ? (params.scope as "ALL" | DocumentScope)
    : "ALL";

  const [documentTypes, residents, employees, documents] = await Promise.all([
    prisma.documentType.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.resident.findMany({
      where: { homeId: user.homeId, dischargedAt: null },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.employee.findMany({
      where: { homeId: user.homeId, terminatedAt: null },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.document.findMany({
      where: {
        homeId: user.homeId,
        ...(params.type ? { documentTypeId: params.type } : {}),
        ...(scope === "ALL" ? {} : { documentType: { scope } }),
      },
      include: {
        documentType: true,
        resident: { select: { id: true, firstName: true, lastName: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const filteredType = params.type
    ? documentTypes.find((t) => t.id === params.type)
    : undefined;

  const returnTo = `/documents${params.type ? `?type=${params.type}` : scope !== "ALL" ? `?scope=${scope}` : ""}`;

  return (
    <>
      <PageHeader
        title="Document vault"
        description="Every record the state may ask to see, filed against the requirement that calls for it."
        action={
          <Link href="/settings/document-types" className="btn-secondary">
            Manage document types
          </Link>
        }
      />

      <ErrorBanner message={params.error} />
      {params.uploaded && <NoticeBanner message="Document uploaded and filed." />}
      {params.deleted && <NoticeBanner message="Document deleted." />}
      {params.saved && <NoticeBanner message="Saved." />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title={filteredType ? filteredType.name : "Filed documents"}
            description={
              filteredType
                ? filteredType.description ?? undefined
                : `${documents.length} document${documents.length === 1 ? "" : "s"} on file.`
            }
            action={
              filteredType ? (
                <Link href="/documents" className="btn-secondary btn-sm">
                  Clear filter
                </Link>
              ) : undefined
            }
          >
            {!filteredType && (
              <nav className="mb-4 flex flex-wrap gap-2">
                {SCOPE_TABS.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.key === "ALL" ? "/documents" : `/documents?scope=${tab.key}`}
                    className={
                      tab.key === scope
                        ? "rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                        : "rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    }
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
            )}

            <DocumentTable documents={documents as VaultDocument[]} returnTo={returnTo} />
          </Card>
        </div>

        <div>
          <Card title="Upload a document" description="It files itself against the right requirement.">
            <DocumentUploadForm
              documentTypes={documentTypes.map((t) => ({
                id: t.id,
                name: t.name,
                scope: t.scope as DocumentScope,
                category: t.category,
                renewalMonths: t.renewalMonths,
                description: t.description,
              }))}
              residents={residents.map((r) => ({
                id: r.id,
                label: `${r.firstName} ${r.lastName}`,
              }))}
              employees={employees.map((e) => ({
                id: e.id,
                label: `${e.firstName} ${e.lastName}`,
              }))}
              returnTo={returnTo}
              lockedTypeId={filteredType?.id}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
