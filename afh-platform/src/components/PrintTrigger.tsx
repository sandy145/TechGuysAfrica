"use client";

/** Small client island so printable pages can stay server components. */
export function PrintTrigger({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary no-print">
      {label}
    </button>
  );
}
