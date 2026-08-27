/**
 * Optionally create/patch the schema during the deploy build.
 *
 * A build host can reach the database; whoever is setting the deployment up
 * often cannot (corporate networks routinely block 5432/6543). So the schema
 * step can be moved into the build — but only deliberately, because a schema
 * push against a database holding real inspections is not something that
 * should ever happen as a side effect of deploying.
 *
 * Off unless PRISMA_DB_PUSH=1. Never passes --accept-data-loss: if the push
 * would drop a column, the build fails and a human looks at it.
 */

import { spawnSync } from "node:child_process";

if (process.env.PRISMA_DB_PUSH !== "1") {
  console.log("PRISMA_DB_PUSH is not set — leaving the schema alone.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("PRISMA_DB_PUSH=1 but DATABASE_URL is not set.");
  process.exit(1);
}

console.log("PRISMA_DB_PUSH=1 — pushing the schema before building.");

const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--schema=prisma/schema.postgres.prisma", "--skip-generate"],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
