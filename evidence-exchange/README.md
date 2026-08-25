# Evidence Exchange

A post-inspection evidence and determination system for a state adult family
home licensing programme. It is built to be handed to an agency, not sold to
providers: the agency owns the record, the provider gets an account on it.

## The failure it prevents

Between the exit conference and the statement of deficiencies, a provider
produces the record that answers a finding. Today that record travels by email.
It lands in a thread, sometimes as an attachment alongside a dozen others.
Nothing in an inbox knows which finding a document answers, whether anyone
opened it, or what a decision was based on. When one is missed, a finding that
should have been resolved — or handled as a consultation — becomes a citation
on the public record of a home that met the requirement. The provider's only
remedy is to notice and object.

`docs/inspection-process.md` walks the real inspection process and shows where
this sits in it.

## What makes it different from a document portal

Four rules, enforced on the server in `src/lib/workflow.ts`, on the same code
path as the write:

1. **A citation cannot be recorded against unread evidence.** If a provider
   submission is unreviewed, or an uploaded file has never been opened by an
   agency user, the determination is refused and the reason is shown. Opening a
   file is measured by actually retrieving its bytes (`/api/files/[id]`), not by
   a checkbox.
2. **The two-source standard is checked.** A citation on fewer independent
   evidence sources than the programme requires needs a supervisor's written
   override, which is stored on the determination and printed on the statement.
3. **Silence is distinguished from disagreement.** "Nothing was submitted before
   the deadline" is recorded as a fact on the determination, separately from
   "submitted, considered, and cited anyway".
4. **The basis of a decision is frozen.** Each determination snapshots the
   submissions and files that existed when it was made, so a later upload cannot
   rewrite a past decision — it appears as new activity instead.

Around those: working-day deadline arithmetic that respects state holidays,
receipts with content digests, an append-only audit log, and a printed statement
of deficiencies that carries its own evidence index.

## Running it

```bash
cp .env.example .env
npm install
npm run setup      # prisma generate + db push + seed
npm run dev        # http://localhost:3000
```

Every seeded account uses the password `Exchange2026!`:

| Account | Who |
| --- | --- |
| `inspector@example.wa.gov` | Marisol Reyes, licensor — **start here** |
| `supervisor@example.wa.gov` | Dana Whitfield, field manager |
| `admin@example.wa.gov` | Priya Raman, programme administrator |
| `adeline@cedargroveafh.example` | Provider, Cedar Grove Adult Family Home |
| `tomas@willowcreekafh.example` | Provider, Willow Creek Adult Family Home |

The seeded scenario is the one the product was built for: a full inspection six
days past its exit conference, with five findings, one of which (`F-01`) has the
document that resolves it sitting unread. Sign in as the licensor, try to cite
`F-01`, and watch the system refuse.

### End-to-end test

```bash
npm run build && npm run db:reset
npx next start -p 3131 &
npm run smoke
```

24 checks covering the upload → queue → blocked citation → open → review →
determination path, tenancy isolation, and the printed packet.

## Architecture

Next.js App Router, TypeScript, Prisma, Tailwind. No client-side state library,
no auth library, no component library — a system a state has to review, host,
and maintain is better served by a small dependency surface.

```
src/lib/workflow.ts     the gates; pure functions, no database
src/lib/dates.ts        working-day arithmetic with state holidays
src/lib/audit.ts        append-only log, written beside every change
src/lib/storage.ts      local-disk evidence store, digests, path checks
src/lib/queries.ts      the review queue and the attention lists
src/app/actions/        server actions; every gate runs here
src/app/(agency)/       licensor, supervisor, and administrator views
src/app/(provider)/     the provider portal
src/app/sod/[id]/       printable statement of deficiencies + evidence index
```

- **Sessions** are HMAC-signed cookies with a 12-hour life; passwords are scrypt.
- **Storage** is the local filesystem behind four functions. Point them at S3 or
  the state's object store and nothing else changes.
- **Database** is SQLite for zero-setup evaluation. The schema is
  Postgres-compatible; change the `datasource` block and the `DATABASE_URL`.
- **Mail** is written to an outbox table rather than sent, so nothing claims a
  delivery that did not happen. Notifications deliberately carry no case
  documents — email is a doorbell, and the record stays behind the sign-in.

## What is deliberately not built

Honest about the gap between a working prototype and a system a state can run:

- **No authoritative rule table.** `src/lib/wac-catalog.ts` is a starter list of
  requirement topics, every entry flagged `verified: false`, with a warning shown
  wherever it appears in the UI. An agency loads its own rule export before use.
- **No SSO.** Real deployment goes behind the state's identity provider; replace
  `getCurrentUser()` in `src/lib/auth.ts`.
- **No integration with the licensing system of record.** Homes are entered or
  seeded; production would sync licences, and push determinations back.
- **No virus scanning on upload**, no encryption at rest, no retention or
  records-schedule automation. All three are procurement requirements, not
  design questions.
- **No public-facing inspection results feed.** Deciding what becomes public, and
  when, is a policy call for the agency.

See `docs/for-the-agency.md` for how a pilot would be scoped.
