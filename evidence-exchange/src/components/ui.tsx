import Link from "next/link";
import type { ReactNode } from "react";

// Small, boring building blocks. A licensing tool is read under time pressure
// and printed into case files, so everything here favours legibility and
// contrast over decoration.

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-gov-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const TONES: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-gov-50 text-gov-700 ring-gov-200",
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  urgent: "bg-red-600 text-white ring-red-700",
};

export type Tone = keyof typeof TONES;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <button {...props} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}

export function buttonClass(variant = "primary", size: "sm" | "md" = "md"): string {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gov-500 focus-visible:ring-offset-1";
  const sizing = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const look =
    variant === "primary"
      ? "bg-gov-700 text-white hover:bg-gov-800"
      : variant === "danger"
        ? "bg-red-700 text-white hover:bg-red-800"
        : variant === "ghost"
          ? "text-gov-700 hover:bg-gov-50"
          : "border border-slate-300 bg-white text-ink hover:bg-slate-50";
  return `${base} ${sizing} ${look}`;
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      {hint ? <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:border-gov-500 focus:outline-none focus:ring-1 focus:ring-gov-500";

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title?: ReactNode;
  children?: ReactNode;
}) {
  const look =
    tone === "danger"
      ? "border-red-300 bg-red-50 text-red-900"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : tone === "ok"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-gov-200 bg-gov-50 text-gov-900";
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${look}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-soft">{children}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "neutral",
  href,
  note,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  href?: string;
  note?: ReactNode;
}) {
  const body = (
    <div
      className={`rounded-lg border bg-white px-4 py-3 shadow-sm transition ${
        tone === "urgent"
          ? "border-red-300 ring-1 ring-red-200"
          : tone === "warn"
            ? "border-amber-300"
            : "border-slate-200"
      } ${href ? "hover:border-gov-400 hover:shadow" : ""}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "urgent" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-ink"
        }`}
      >
        {value}
      </p>
      {note ? <p className="mt-0.5 text-xs text-ink-soft">{note}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Definition row used all over the detail pages. */
export function Detail({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <button type="submit" {...props} className={buttonClass(variant, size)}>
      {children}
    </button>
  );
}
