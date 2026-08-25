import Link from "next/link";
import type { ReactNode } from "react";
import type { Severity } from "@/lib/constants";
import type { FindingStatus } from "@/lib/compliance/engine";

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {action && <div className="no-print flex gap-2">{action}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}
      </div>
      {action && <div className="no-print flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}

const STATUS_STYLES: Record<FindingStatus, string> = {
  PASS: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  MISSING: "bg-red-50 text-red-700 ring-red-600/20",
  EXPIRED: "bg-red-50 text-red-700 ring-red-600/20",
  OVERDUE: "bg-orange-50 text-orange-700 ring-orange-600/20",
  EXPIRING: "bg-amber-50 text-amber-800 ring-amber-600/20",
  UNDATED: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function StatusPill({ status, label }: { status: FindingStatus; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-amber-400 text-amber-950",
  LOW: "bg-slate-200 text-slate-700",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "brand" | "amber" | "red" | "emerald";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
    brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
    amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "slate" | "red" | "amber" | "emerald" | "brand";
}) {
  const tones = {
    slate: "text-slate-900",
    red: "text-red-600",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    brand: "text-brand-600",
  };
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Inline form error banner used by every server action page. */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function NoticeBanner({ message, tone = "brand" }: { message?: string | null; tone?: "brand" | "amber" }) {
  if (!message) return null;
  const tones = {
    brand: "border-brand-200 bg-brand-50 text-brand-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{message}</div>
  );
}

/** Renders a WAC citation, flagging seed entries that aren't verified yet. */
export function WacCite({
  cite,
  title,
  verified = true,
}: {
  cite: string | null;
  title?: string | null;
  verified?: boolean;
}) {
  if (!cite) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <Link
        href={`/regulations?cite=${encodeURIComponent(cite)}`}
        className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
      >
        {cite}
      </Link>
      {title && <span className="hidden sm:inline">· {title}</span>}
      {!verified && (
        <span
          title="This citation was seeded as a starting point and has not been verified against the official WAC text."
          className="rounded bg-amber-100 px-1 text-[10px] font-bold uppercase text-amber-800"
        >
          unverified
        </span>
      )}
    </span>
  );
}
