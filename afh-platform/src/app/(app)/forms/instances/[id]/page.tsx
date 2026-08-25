import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  requestSignatureAction,
  signInternalAction,
  updateFormInstanceAction,
  voidFormInstanceAction,
} from "@/app/actions/forms";
import {
  checkMissingFields,
  instanceValues,
  renderInstance,
  templateFields,
  templateSigners,
} from "@/lib/forms/instance";
import { formatDate, toDateInput } from "@/lib/dates";
import { FORM_STATUS_LABELS, type FormStatus } from "@/lib/constants";
import { DynamicFormFields } from "@/components/DynamicFormFields";
import { PrintTrigger } from "@/components/PrintTrigger";
import { SignaturePad } from "@/components/SignaturePad";
import { Badge, Card, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const CONSENT_TEXT =
  "By signing below I confirm that I have read this document and that my electronic signature " +
  "is the legal equivalent of my handwritten signature.";

export default async function FormInstancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    signed?: string;
    voided?: string;
    requested?: string;
  }>;
}) {
  const user = await requireHome();
  const { id } = await params;
  const query = await searchParams;

  const instance = await prisma.formInstance.findFirst({
    where: { id, homeId: user.homeId },
    include: {
      template: true,
      resident: { select: { id: true, firstName: true, lastName: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
      signatures: { orderBy: { createdAt: "asc" } },
      document: true,
    },
  });

  if (!instance) notFound();

  const [body, home] = await Promise.all([
    renderInstance(instance),
    prisma.home.findUnique({ where: { id: user.homeId } }),
  ]);

  const missing = checkMissingFields(instance);
  const signers = templateSigners(instance.template);
  const editable = instance.status === "DRAFT" || instance.status === "AWAITING_SIGNATURES";

  const subject = instance.resident
    ? `${instance.resident.firstName} ${instance.resident.lastName}`
    : instance.employee
      ? `${instance.employee.firstName} ${instance.employee.lastName}`
      : home?.name ?? "The home";

  // Freshly issued signing link, shown so it can be copied — nothing is
  // actually emailed in this build.
  const justRequested = query.requested
    ? instance.signatures.find((s) => s.id === query.requested)
    : undefined;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={instance.template.title}
        description={`${subject} · ${FORM_STATUS_LABELS[instance.status as FormStatus] ?? instance.status}`}
        action={
          <>
            <Link href="/forms" className="btn-secondary">
              All forms
            </Link>
            <PrintTrigger label="Print form" />
          </>
        }
      />

      <ErrorBanner message={query.error} />
      {query.saved && <NoticeBanner message="Draft saved." />}
      {query.signed && <NoticeBanner message="Signature recorded." />}
      {query.voided && <NoticeBanner message="This form has been voided." tone="amber" />}

      {justRequested?.accessToken && (
        <NoticeBanner
          tone="amber"
          message={`Signing link for ${justRequested.signerLabel}: ${appUrl}/sign/${justRequested.accessToken} — no email transport is configured in this build, so copy this link and send it yourself. It expires in 21 days.`}
        />
      )}

      {instance.status === "COMPLETED" && (
        <NoticeBanner
          message={`Completed ${formatDate(instance.completedAt)}. ${
            instance.document
              ? "A copy is filed in the vault."
              : "This form type isn't linked to a vault document type."
          }`}
        />
      )}

      {missing.length > 0 && instance.status !== "COMPLETED" && (
        <NoticeBanner
          tone="amber"
          message={`Still blank: ${missing.map((f) => f.label).join(", ")}. You can sign anyway, but the printed form will show blanks.`}
        />
      )}

      {/* The printable document itself. */}
      <section className="card avoid-break mb-6 px-8 py-8">
        <header className="mb-6 border-b border-slate-300 pb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            {home?.name}
            {home?.licenseNumber ? ` · License ${home.licenseNumber}` : ""}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{instance.template.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {subject} · Effective {formatDate(instance.effectiveAt)}
            {instance.template.wacCite && ` · ${instance.template.wacCite}`}
          </p>
        </header>

        {/* renderBody() escapes all template and user text and emits only its own
            markup, so this is safe to inject. */}
        <div className="text-sm text-slate-800" dangerouslySetInnerHTML={{ __html: body }} />

        <div className="mt-8 grid gap-6 border-t border-slate-300 pt-6 sm:grid-cols-2">
          {instance.signatures.map((signature) => (
            <div key={signature.id} className="avoid-break">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {signature.signerLabel}
              </p>
              <div className="mt-1 flex h-16 items-end border-b border-slate-400">
                {signature.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signature.imageData}
                    alt={`Signature of ${signature.signerName ?? signature.signerLabel}`}
                    className="max-h-16"
                  />
                ) : signature.typedName ? (
                  <span className="pb-1 font-serif text-xl italic text-slate-900">
                    {signature.typedName}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {signature.signerName ?? "________________"}
                {signature.signedAt ? ` · signed ${formatDate(signature.signedAt)}` : " · unsigned"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="no-print grid gap-6 lg:grid-cols-2">
        <Card title="Signatures" description="Sign here, or send a private link to someone else.">
          <ul className="space-y-5">
            {instance.signatures.map((signature) => {
              const definition = signers.find((s) => s.key === signature.signerKey);
              const isRemote = definition?.remote;

              return (
                <li key={signature.id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{signature.signerLabel}</p>
                    {signature.signedAt ? (
                      <Badge tone="emerald">Signed {formatDate(signature.signedAt)}</Badge>
                    ) : signature.accessToken ? (
                      <Badge tone="amber">Link sent</Badge>
                    ) : (
                      <Badge tone="slate">Not signed</Badge>
                    )}
                  </div>

                  {signature.signedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {signature.signerName}
                      {signature.signerEmail ? ` · ${signature.signerEmail}` : ""}
                      {signature.ipAddress ? ` · from ${signature.ipAddress}` : ""}
                    </p>
                  ) : instance.status === "VOIDED" ? (
                    <p className="mt-1 text-xs text-slate-500">This form is voided.</p>
                  ) : isRemote ? (
                    <>
                      {/* The link is shown here for as long as it is live, not
                          just in the flash message right after it is issued —
                          with no mail transport configured this is how the
                          provider actually gets it to the family. */}
                      {signature.accessToken && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <p className="text-xs font-semibold text-amber-900">
                            Outstanding signing link
                            {signature.tokenExpiresAt &&
                              ` · expires ${formatDate(signature.tokenExpiresAt)}`}
                          </p>
                          <p className="mt-1 break-all font-mono text-xs text-amber-900">
                            {appUrl}/sign/{signature.accessToken}
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            Send this to {signature.signerEmail ?? "the signer"} yourself. It works
                            once, then stops.
                          </p>
                        </div>
                      )}

                      <form action={requestSignatureAction} className="mt-3 space-y-2">
                        <input type="hidden" name="signatureId" value={signature.id} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            name="signerName"
                            placeholder="Their name"
                            defaultValue={signature.signerName ?? ""}
                            className="input"
                          />
                          <input
                            name="signerEmail"
                            type="email"
                            required
                            placeholder="Their email"
                            defaultValue={signature.signerEmail ?? ""}
                            className="input"
                          />
                        </div>
                        <button type="submit" className="btn-secondary btn-sm">
                          {signature.accessToken ? "Re-issue signing link" : "Send signing link"}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="mt-3">
                      <SignaturePad
                        action={signInternalAction}
                        signatureId={signature.id}
                        signerLabel={signature.signerLabel}
                        consentText={CONSENT_TEXT}
                        defaultName={user.name}
                        submitLabel={`Sign as ${signature.signerLabel}`}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          {editable && (
            <Card title="Edit the answers" description="Changes apply until the last signature lands.">
              <form action={updateFormInstanceAction} className="space-y-5">
                <input type="hidden" name="id" value={instance.id} />

                <div>
                  <label className="label" htmlFor="effectiveAt">
                    Effective date
                  </label>
                  <input
                    id="effectiveAt"
                    name="effectiveAt"
                    type="date"
                    defaultValue={toDateInput(instance.effectiveAt)}
                    className="input sm:max-w-xs"
                  />
                </div>

                <DynamicFormFields
                  fields={templateFields(instance.template)}
                  values={instanceValues(instance)}
                />

                <button type="submit" className="btn-primary">
                  Save draft
                </button>
              </form>
            </Card>
          )}

          {instance.status !== "VOIDED" && (
            <Card title="Void this form">
              <p className="text-sm text-slate-600">
                Voiding keeps the record and its signatures for your audit trail but marks it
                superseded, and cancels any signing links that are still out.
              </p>
              <form action={voidFormInstanceAction} className="mt-3">
                <input type="hidden" name="id" value={instance.id} />
                <button type="submit" className="btn-danger btn-sm">
                  Void form
                </button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
