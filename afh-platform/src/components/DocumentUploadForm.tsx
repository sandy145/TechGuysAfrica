"use client";

import { useMemo, useState } from "react";
import { uploadDocumentAction } from "@/app/actions/documents";

export type UploadOption = { id: string; label: string };
export type UploadDocType = {
  id: string;
  name: string;
  scope: "HOME" | "RESIDENT" | "EMPLOYEE";
  category: string;
  renewalMonths: number | null;
  description: string | null;
};

/**
 * Upload form. Client-side only so the resident/employee picker can follow the
 * selected document type — filing a TB test under the house instead of a
 * caregiver is the single easiest way to fail a check that you have satisfied.
 */
export function DocumentUploadForm({
  documentTypes,
  residents,
  employees,
  returnTo,
  lockedTypeId,
  lockedResidentId,
  lockedEmployeeId,
}: {
  documentTypes: UploadDocType[];
  residents: UploadOption[];
  employees: UploadOption[];
  returnTo: string;
  lockedTypeId?: string;
  lockedResidentId?: string;
  lockedEmployeeId?: string;
}) {
  // When opened from a resident or employee page, only that subject's types
  // make sense.
  const available = useMemo(() => {
    if (lockedResidentId) return documentTypes.filter((t) => t.scope === "RESIDENT");
    if (lockedEmployeeId) return documentTypes.filter((t) => t.scope === "EMPLOYEE");
    return documentTypes;
  }, [documentTypes, lockedResidentId, lockedEmployeeId]);

  const [typeId, setTypeId] = useState(lockedTypeId ?? available[0]?.id ?? "");
  const selected = available.find((t) => t.id === typeId);

  const grouped = useMemo(() => {
    const map = new Map<string, UploadDocType[]>();
    for (const type of available) {
      const list = map.get(type.category);
      if (list) list.push(type);
      else map.set(type.category, [type]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [available]);

  if (available.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No document types are defined for this section yet.
      </p>
    );
  }

  return (
    <form action={uploadDocumentAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <label className="label" htmlFor="documentTypeId">
          Document type <span className="text-red-600">*</span>
        </label>
        <select
          id="documentTypeId"
          name="documentTypeId"
          required
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="input"
        >
          {grouped.map(([category, types]) => (
            <optgroup key={category} label={category}>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selected?.description && (
          <p className="mt-1 text-xs text-slate-500">{selected.description}</p>
        )}
      </div>

      {selected?.scope === "RESIDENT" && (
        <div>
          <label className="label" htmlFor="residentId">
            Resident <span className="text-red-600">*</span>
          </label>
          {lockedResidentId ? (
            <input type="hidden" name="residentId" value={lockedResidentId} />
          ) : (
            <select id="residentId" name="residentId" required className="input">
              <option value="">Select a resident…</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
          {!lockedResidentId && residents.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Add a resident first — this document type files under a resident.
            </p>
          )}
        </div>
      )}

      {selected?.scope === "EMPLOYEE" && (
        <div>
          <label className="label" htmlFor="employeeId">
            Employee <span className="text-red-600">*</span>
          </label>
          {lockedEmployeeId ? (
            <input type="hidden" name="employeeId" value={lockedEmployeeId} />
          ) : (
            <select id="employeeId" name="employeeId" required className="input">
              <option value="">Select an employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          )}
          {!lockedEmployeeId && employees.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Add an employee first — this document type files under an employee.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="file">
          File <span className="text-red-600">*</span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.tif,.tiff,.doc,.docx,.xls,.xlsx,.txt"
          className="input file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
        />
        <p className="mt-1 text-xs text-slate-500">
          A phone photo of a paper record is fine. Up to 25 MB.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="issuedAt">
            Date issued
          </label>
          <input id="issuedAt" name="issuedAt" type="date" className="input" />
          {selected?.renewalMonths && (
            <p className="mt-1 text-xs text-slate-500">
              Renews every {selected.renewalMonths} months — the expiry date is worked out for
              you if you leave it blank.
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="expiresAt">
            Expires
          </label>
          <input id="expiresAt" name="expiresAt" type="date" className="input" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="title">
          Label (optional)
        </label>
        <input
          id="title"
          name="title"
          placeholder={selected?.name ?? ""}
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="notes">
          Notes (optional)
        </label>
        <textarea id="notes" name="notes" rows={2} className="input" />
      </div>

      <button type="submit" className="btn-primary">
        Upload to vault
      </button>
    </form>
  );
}
