import { prisma } from "@/lib/db";
import { signRemoteAction } from "@/app/actions/forms";
import { renderInstance } from "@/lib/forms/instance";
import { formatDate } from "@/lib/dates";
import { SignaturePad } from "@/components/SignaturePad";
import { ErrorBanner } from "@/components/ui";

export const dynamic = "force-dynamic";

const CONSENT_TEXT =
  "By signing below I confirm that I have read this document and that my electronic signature " +
  "is the legal equivalent of my handwritten signature.";

/**
 * Remote signing for people with no account — usually a resident's family
 * member or legal representative. The token is the only credential, so the page
 * shows the document and nothing else about the home's records.
 */
export default async function RemoteSignPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  const signature = await prisma.signature.findUnique({
    where: { accessToken: token },
    include: {
      formInstance: {
        include: {
          template: true,
          home: { select: { name: true, licenseNumber: true, phone: true } },
          resident: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (query.done) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-slate-900">Thank you — your signature is recorded.</h1>
        <p className="mt-3 text-slate-600">
          The adult family home has been notified. You can close this page. This link has now been
          used and will not open again.
        </p>
      </Shell>
    );
  }

  if (!signature || (signature.tokenExpiresAt && signature.tokenExpiresAt < new Date())) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-slate-900">This link is no longer valid</h1>
        <p className="mt-3 text-slate-600">
          Signing links expire, and each one can only be used once. Please contact the adult
          family home and ask them to send a new one.
        </p>
      </Shell>
    );
  }

  if (signature.signedAt) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-slate-900">Already signed</h1>
        <p className="mt-3 text-slate-600">
          This document was signed on {formatDate(signature.signedAt)}.
        </p>
      </Shell>
    );
  }

  const instance = signature.formInstance;
  const body = await renderInstance(instance);

  return (
    <Shell wide>
      <ErrorBanner message={query.error} />

      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        Signature requested
      </p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{instance.template.title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        From {instance.home.name}
        {instance.home.phone ? ` · ${instance.home.phone}` : ""}
        {instance.resident
          ? ` · regarding ${instance.resident.firstName} ${instance.resident.lastName}`
          : ""}
      </p>

      <section className="card mt-6 px-7 py-7">
        {/* Escaped and re-marked-up server-side by renderBody(). */}
        <div className="text-sm text-slate-800" dangerouslySetInnerHTML={{ __html: body }} />
      </section>

      <section className="card mt-6 px-7 py-6">
        <h2 className="text-base font-semibold text-slate-900">
          Sign as {signature.signerLabel}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Read the document above before signing. If anything looks wrong, contact the home
          instead of signing.
        </p>
        <div className="mt-4">
          <SignaturePad
            action={signRemoteAction}
            token={token}
            signerLabel={signature.signerLabel}
            consentText={CONSENT_TEXT}
            defaultName={signature.signerName ?? ""}
            submitLabel="Sign document"
          />
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className={wide ? "mx-auto max-w-3xl" : "mx-auto max-w-xl"}>
        <p className="mb-6 text-center text-sm font-bold text-brand-700">AFH Compliance</p>
        {children}
      </div>
    </main>
  );
}
