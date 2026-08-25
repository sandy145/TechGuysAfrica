import { requireProvider } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireProvider();

  return (
    <AppShell
      nav={[
        { href: "/portal", label: "My findings" },
        { href: "/portal/idr", label: "Dispute a citation" },
      ]}
      userName={user.name}
      userDetail={`${user.providerHomeName} · licence ${user.licenseNumber}`}
      side="provider"
    >
      {children}
    </AppShell>
  );
}
