# AFH Compliance

A compliance platform for **Washington State licensed adult family homes**.

One place to keep the documentation a licensor will ask for, generate and sign
the forms that go in the file, see what other providers are being cited for,
and find out — specifically, against your own records — when a rule change
leaves you out of compliance.

```bash
cd afh-platform
cp .env.example .env
npm install
npm run setup     # generate client, create the database, seed the catalog + a demo home
npm run dev       # http://localhost:3000
```

Sign in as `demo@example.com` / `demo-password-123`.

---

## Read this first

**The seeded rule catalog is a scaffold, not law.** The subchapter names and
section ranges in `prisma/seed-data/regulations.ts` come from the published
structure of chapter 388-76 WAC, but the individual section titles are
descriptive labels written for this catalog and no rule text has been
reproduced or verified. Every seeded entry is stored with `verified: false`,
which renders an **unverified** badge everywhere the citation appears.

Before anyone uses this to prepare for a real survey:

1. Check each entry against <https://app.leg.wa.gov/wac/default.aspx?cite=388-76>.
2. Bulk-load a checked catalog with `npm run wac:import -- ./wac-388-76.json`
   (the importer sets `verified: true`; its expected JSON shape is documented
   at the top of `scripts/import-wac.ts`).

Same applies to the document types, rule checks, and form templates: they
encode what adult family homes commonly keep, not verified legal requirements.
Where the department publishes an official form, use the official one and
upload it to the vault instead. **This platform organises records; it does not
interpret the law.**

---

## What it does

### 1. Document vault and expiry tracking
Resident files, employee files, and home records, each filed against the
requirement that calls for it. Phone photos of paper records are fine. Expiry
is either recorded directly or derived from the issue date plus the document
type's renewal interval, so a lapsed TB test or CPR card surfaces weeks early
instead of during an inspection.

### 2. Compliance engine
The engine (`src/lib/compliance/engine.ts`) evaluates every applicable rule
check against the home's real records and returns findings with a status
(`MISSING`, `EXPIRED`, `EXPIRING`, `OVERDUE`, `UNDATED`, `PASS`), the citation,
and what to do about it.

The interesting part is **applicability**. A check declares a predicate against
the home profile and, for per-subject checks, against the resident or employee:

```ts
{
  code: "employee_dementia_training",
  checkType: "PER_EMPLOYEE_DOCUMENT",
  appliesWhen: { employsStaff: true, specialtiesIncludeAny: ["DEMENTIA"] },
  subjectWhen: { roleIn: ["PROVIDER", "CAREGIVER", "SUBSTITUTE", ...] },
}
```

So a home with no staff is never asked for employee files, a resident who
self-administers medication is asked for a self-administration assessment
rather than a MAR, and a home without a dementia designation never sees
dementia training requirements at all. The dashboard reports how many checks
were skipped as inapplicable.

Deadline rules (`withinDaysOfAdmission`, `withinDaysOfHire`) are measured
against the **earliest** document on file, not the newest, and stop applying
once a full review cycle has passed since admission or hire — otherwise this
year's annual review of a five-year resident reads as hundreds of days late,
and a home that has only backfilled its current paperwork gets told its records
are overdue.

### 3. Dynamic forms with e-signature
A `FormTemplate` is a JSON field schema plus a body with `{{token}}`
placeholders. Filling it renders a printable document; tokens resolve from the
form's own fields and from a context set (`home_name`, `home_license`,
`resident_name`, `today`, …).

- Staff sign on screen with a draw-to-sign canvas; a typed name alone is
  sufficient, so keyboard-only devices work.
- Family members and legal representatives get a **tokenized signing link** —
  no account. The link is single-use, expires in 21 days, and is burned on use.
- When the last required signer is in, the rendered body is **snapshotted** and
  a `Document` is filed into the vault. Later edits to the template can never
  rewrite what somebody signed.
- Collecting an optional extra signature afterwards does not un-finalise a
  completed form.

Seven starter templates ship: negotiated care plan, resident rights
acknowledgement, admission agreement, medication self-administration
assessment, employee orientation checklist, job description, disaster plan.

### 4. Anonymous citation board
Providers post the deficiencies they received so others can avoid them.
Anonymity is the whole product here, so:

- The author is a **salted one-way digest**, never a foreign key. It supports
  rate limiting and "withdraw my post", nothing else.
- `ANON_SALT` lives outside the database, so a database leak alone deanonymises
  nobody, and rotating the salt permanently detaches every post from its author.
- Location is county-level, dates are quarter-level.
- Phone numbers, emails, street addresses, licence numbers, and long digit runs
  are **stripped before storage**, and the author is shown what was removed
  rather than having their account of an inspection silently edited.
- Posts are held for moderation before publication. Set
  `AUTO_APPROVE_CITATIONS=true` for a single-operator install.

Linking a post to your own home is opt-in and off by default; it exists only so
you can find your own post later.

Every citation links to its rule, and any signed-in provider can run **that
same rule against their own records in one click** — "you have 2 gaps against
this rule" or "you look covered".

### 5. Rule updates that check themselves against you
A `RegulatoryUpdate` lists the rule-check codes it touches. The updates feed,
the dashboard panel, and the email digest all run those checks against the
reader's own home, so a change is reported as *"2 gaps at your home — Ana R.
missing, David P. missing"* rather than *"a rule changed"*.

### 6. Subscriptions and digests
Four topics: new citations, rule updates, expiring documents, open compliance
gaps. The last two require the subscription to be linked to a home. Double
opt-in; one-click unsubscribe token.

### 7. Printable inspection binder
Cover sheet with the home's details and a met/expiring/outstanding summary,
an outstanding-items list, then a tab per resident and per employee with a
requirement checklist and a document index. Print CSS gives page breaks per tab.

---

## Stack and layout

Next.js 15 (App Router) · React 19 · TypeScript · Prisma · SQLite · Tailwind.

No auth library and no bcrypt: sessions are HMAC-signed cookies and passwords
use scrypt, both from `node:crypto`. Keeps the dependency and native-build
surface at zero.

```
prisma/
  schema.prisma            data model (SQLite; see the note on enums)
  seed.ts                  catalog + demo home
  seed-data/               regulations, document types, rule checks, templates, sample feed
scripts/
  import-wac.ts            bulk-load a verified WAC catalog
  smoke.mjs                end-to-end browser test
src/lib/
  compliance/engine.ts     the rules engine
  forms/                   field types, token rendering, instance helpers
  anon.ts                  author hashing + identifier scrubbing
  auth.ts  storage.ts  mailer.ts  newsletter.ts
src/app/
  (app)/                   authenticated app + public citation board and catalog
  sign/[token]/            remote signing, no account
  api/documents/[id]/      access-controlled file serving
```

SQLite has no enums or arrays, so status columns are `String` (constrained in
`src/lib/constants.ts`) and list columns hold JSON text. Both survive a move to
Postgres unchanged — only the `datasource` block changes.

---

## Testing

```bash
npm run typecheck
npm run build
npm run db:reset
npx next start -p 3111 &
npm run smoke
```

`npm run smoke` drives a real browser through 45 assertions covering all six
feature areas, including the applicability logic, the full form-to-remote-
signature flow, identifier scrubbing, digest personalisation, and cross-tenant
isolation (a second home must get a 404 on the first home's resident URLs).

---

## Before production

This runs correctly and the data model is sound, but it is a v1. In rough
priority order:

1. **Verify the rule catalog.** Nothing else matters until the citations are
   real. See the note at the top.
2. **Wire a mail transport.** `src/lib/mailer.ts` has a single `transport`
   hook, currently `null`; every message is queued to the `OutboxMessage` table
   and shown at `/admin/outbox` rather than silently dropped. Signing links and
   subscription confirmations both go through it, so today they have to be
   copied from the outbox by hand.
3. **Handle PHI properly.** Resident records are protected health information.
   Uploads currently go to the local filesystem unencrypted and the SQLite file
   is unencrypted. Real deployment needs encryption at rest, a BAA with the
   host, audit logging of every record access, and a retention policy.
4. **Move to Postgres** and object storage — change the `datasource` block and
   reimplement the four functions in `src/lib/storage.ts`.
5. **Add rate limiting** on login and citation posting beyond the current
   per-home daily cap.
6. **Schedule the digests.** `sendDueDigests()` in `src/lib/newsletter.ts` is
   ready for a cron job; right now an admin triggers it from `/admin/outbox`.
7. **Real PDF generation.** Forms print via browser print CSS, which is genuinely
   fine for a binder, but a server-rendered PDF would be better for archiving.
8. **Role granularity.** `OWNER`/`ADMIN`/`STAFF` exist but only `ADMIN` is
   enforced (moderation, digest runs). Staff should not be able to delete
   resident records.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string. |
| `SESSION_SECRET` | Signs session cookies and signing links. **Change it.** |
| `ANON_SALT` | Derives citation author digests. Rotating it detaches every post from its author. **Change it.** |
| `STORAGE_DIR` | Where uploads are written. Everything under here is PHI. |
| `APP_URL` | Public base URL, used to build signing links. |
| `AUTO_APPROVE_CITATIONS` | `true` skips the moderation queue. |
| `SEED_DEMO` | `false` seeds the catalog without the demo home. |
| `SEED_SAMPLE_UPDATES` | `false` skips the sample update feed and sample citations. |

## Licence

Inherits the repository licence.
