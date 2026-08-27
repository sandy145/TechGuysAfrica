import { requireAgency } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ROLE_LABELS } from "@/lib/constants";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgency();

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/review", label: "Evidence review" },
    { href: "/inspections", label: "Inspections" },
    { href: "/homes", label: "Licensed homes" },
    ...(user.role === "INSPECTOR" ? [] : [{ href: "/oversight", label: "Oversight" }]),
    ...(user.role === "AGENCY_ADMIN" ? [{ href: "/admin/outbox", label: "Outbox" }] : []),
  ];

  return (
    <AppShell
      nav={nav}
      userName={user.name}
      userDetail={`${ROLE_LABELS[user.role]}${user.title ? ` · ${user.title}` : ""}`}
      side="agency"
    >
      {children}
    </AppShell>
  );
}
