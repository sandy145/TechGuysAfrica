import Link from "next/link";
import type { Document, DocumentType, Employee, Resident } from "@prisma/client";
import { deleteDocumentAction } from "@/app/actions/documents";
import { effectiveExpiry } from "@/lib/compliance/engine";
import { daysUntil, formatDate } from "@/lib/dates";
import { formatBytes } from "@/lib/storage";
import { Badge, EmptyState } from "./ui";

export type VaultDocument = Document & {
  documentType: DocumentType;
  resident: Pick<Resident, "id" | "firstName" | "lastName"> | null;
  employee: Pick<Employee, "id" | "firstName" | "lastName"> | null;
};

function expiryBadge(doc: VaultDocument) {
  const expiry = effectiveExpiry(doc, doc.documentType);
  if (!expiry) {
    return doc.documentType.renewalMonths ? (
      <Badge tone="slate">No date</Badge>
    ) : (
      <span className="text-slate-400">—</span>
    );
  }

  const remaining = daysUntil(expiry);
  if (remaining < 0) return <Badge tone="red">Expired {formatDate(expiry)}</Badge>;
  if (remaining <= doc.documentType.warnDays) {
    return <Badge tone="amber">{formatDate(expiry)} ({remaining}d)</Badge>;
  }
  return <span className="text-slate-600">{formatDate(expiry)}</span>;
}

export function DocumentTable({
  documents,
  returnTo,
  showSubject = true,
}: {
  documents: VaultDocument[];
  returnTo: string;
  showSubject?: boolean;
}) {
  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents here yet"
        description="Upload a scan or a phone photo of the paper record and it becomes part of your inspection binder."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="th">Document</th>
            {showSubject && <th className="th">Filed under</th>}
            <th className="th">Issued</th>
            <th className="th">Expires</th>
            <th className="th no-print" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <tr key={doc.id} className="avoid-break hover:bg-slate-50/60">
              <td className="td">
                <div className="font-medium text-slate-900">{doc.title}</div>
                <div className="text-xs text-slate-500">
                  {doc.documentType.name}
                  {doc.fileName ? ` · ${doc.fileName}` : ""}
                  {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                </div>
                {doc.notes && <div className="mt-1 text-xs text-slate-500">{doc.notes}</div>}
              </td>

              {showSubject && (
                <td className="td">
                  {doc.resident ? (
                    <Link
                      href={`/residents/${doc.resident.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {doc.resident.firstName} {doc.resident.lastName}
                    </Link>
                  ) : doc.employee ? (
                    <Link
                      href={`/employees/${doc.employee.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {doc.employee.firstName} {doc.employee.lastName}
                    </Link>
                  ) : (
                    <span className="text-slate-500">The home</span>
                  )}
                </td>
              )}

              <td className="td">{formatDate(doc.issuedAt)}</td>
              <td className="td">{expiryBadge(doc)}</td>

              <td className="td no-print">
                <div className="flex justify-end gap-2">
                  {doc.storageKey && (
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary btn-sm"
                    >
                      View
                    </a>
                  )}
                  {doc.formInstanceId && (
                    <Link href={`/forms/instances/${doc.formInstanceId}`} className="btn-secondary btn-sm">
                      Open form
                    </Link>
                  )}
                  <form action={deleteDocumentAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" className="btn-danger btn-sm">
                      Delete
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
