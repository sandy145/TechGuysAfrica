# Deploying the pilot

The application is written for two homes: a self-hosted box with a disk, and a
serverless host with neither a disk nor a persistent database. This describes
the second, because that is the fastest way to get a testable URL.

Two things change for a serverless deployment, and both are already built:

- **Database** — Postgres instead of SQLite. `prisma/schema.prisma` stays the
  canonical model; `npm run pg:schema` generates the Postgres flavour by
  swapping the datasource block, and `npm run vercel-build` does that as part
  of the build.
- **Uploads** — `STORAGE_DRIVER=database` writes evidence bytes to a
  `FileBlob` row instead of the filesystem. Storage keys carry their own
  driver (`db:<id>`), so a deployment can move to an object store later
  without orphaning what it already holds.

## Context for whoever runs this

Established in the session that wrote this file:

- **Supabase**: use the existing project named **`AFH`** (ref `kjcpsxvnswucwxnswigy`,
  us-east-1, ACTIVE_HEALTHY). Do **not** create a new project. Its `public`
  schema already holds the provider platform's tables, which is exactly why
  this application lives in its own `evidence` schema.
- **Vercel**: team **`AFH`** (slug `afh3`, hobby plan).
- **Repository**: `sandy145/TechGuysAfrica`, branch
  `claude/state-inspection-docs-platform-8q5c63`, root directory
  `evidence-exchange`.

Unrelated but worth knowing before that Supabase project holds anything real:
all 16 tables in its `public` schema have row-level security disabled, so
anyone with the anon key can read or write every row. They are empty today.
The `evidence` schema is not exposed through Supabase's REST API at all, so
this application's tables are not affected.

## 1. Create the database schema

The pilot shares the existing Supabase project rather than adding a new one,
using a dedicated `evidence` Postgres schema so it cannot collide with the
provider platform's tables in `public`.

There are two ways to create it. **Use the first if you cannot reach Postgres
from your own machine** — corporate and cloud networks routinely block 5432 and
6543, and the build host does not have that problem.

### Option A — let the first build create it

Set `PRISMA_DB_PUSH=1` in the environment for one deploy. The build pushes the
schema before compiling, then you remove the variable and redeploy. It never
passes `--accept-data-loss`: if a push would drop a column the build fails
instead, which is the behaviour you want on anything holding real data.

### Option B — run the SQL yourself

Run `prisma/deploy/001_init_evidence_schema.sql` against the project — paste it
into the Supabase SQL editor, or:

```bash
psql "$DATABASE_URL" -f prisma/deploy/001_init_evidence_schema.sql
```

Regenerate it after any schema change with:

```bash
npm run pg:ddl
```

A side benefit of the separate schema: Supabase only exposes `public` (and
schemas explicitly added) through its REST API, so these tables are not
reachable with an anon key at all. They are read solely by the application's
own Postgres connection.

## 2. Create the Vercel project

Point it at this repository with:

| Setting | Value |
| --- | --- |
| Root directory | `evidence-exchange` |
| Framework preset | Next.js |
| Build command | `npm run vercel-build` |
| Install command | `npm install` |

**The build command matters.** `npm run build` regenerates the *SQLite* client
and the deployment will fail at the first query with "the URL must start with
the protocol `file:`". `npm run vercel-build` generates the Postgres client
first. This is a real failure mode, not a theoretical one — it is what happened
on the first verification run.

## 3. Environment variables

```
DATABASE_URL      postgresql://postgres.<ref>:<password>@<pooler-host>:6543/postgres?pgbouncer=true&connection_limit=1&schema=evidence
SESSION_SECRET    31b4c4070684d7af4aca979376e0594a377681c9191a87c1f83a15c44d06c06e
STORAGE_DRIVER    database
MAX_UPLOAD_BYTES  4000000
APP_URL           https://<your-deployment-url>
AGENCY_NAME       Residential Care Services
AGENCY_PARENT     Department of Social and Health Services
SEED_TOKEN        PeSv7dhL5UjXf-_63SsRQ-nv
PRISMA_DB_PUSH    1      # only when using Option A; remove after the first deploy
```

Notes on four of them:

- **`DATABASE_URL`** is the *pooled* connection string from Supabase (Connect →
  Transaction pooler), with `&schema=evidence` appended. Serverless functions
  open a connection per invocation, so the pooler and `connection_limit=1`
  matter.
- **`MAX_UPLOAD_BYTES`** is 4 MB because serverless request bodies are capped
  around 4.5 MB. A self-hosted deployment should raise it — the code defaults to
  25 MB.
- **`SEED_TOKEN`** enables the demonstration data endpoint. **Delete this
  variable once seeding is done.** Without it the route returns 404.
- **`PRISMA_DB_PUSH`** creates the schema during the build. Set it for the
  first deploy only, then remove it — a schema push should be a decision, not
  something that happens every time someone deploys.

The two secrets above were generated for this deployment. Rotate them if they
have been shared anywhere you would not put a password.

## 4. Load the demonstration scenario

After the first successful deploy:

```bash
curl -X POST https://<your-deployment-url>/api/admin/seed \
  -H "x-seed-token: PeSv7dhL5UjXf-_63SsRQ-nv"
```

It responds with the row counts. Then remove `SEED_TOKEN` from the environment
and redeploy.

**This wipes and rebuilds demonstration data.** It must never be enabled on a
deployment holding real inspections.

## 5. Check it works

Sign in as `inspector@example.wa.gov` (password `Exchange2026!`), open finding
`F-01` at Cedar Grove, and try to record a citation. The system should refuse
because the provider's CPR card has not been opened. That single refusal is the
product working.

Then, as `adeline@cedargroveafh.example`, upload a document against `F-03` and
confirm the licensor's queue shows it within a page refresh.

## What this deployment is not

A pilot on a shared host is for evaluating the workflow, not for real case
material. Before any real inspection data goes near it: encryption at rest,
virus scanning on upload, the state's identity provider in front of it, a
retention schedule, and a signed agreement about where resident records live.
