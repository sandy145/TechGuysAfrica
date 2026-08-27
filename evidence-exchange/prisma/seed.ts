/**
 * CLI entry point for seeding a local database.
 *
 *   npm run db:seed
 *
 * The scenario itself lives in src/lib/seed.ts so the hosted deployment, which
 * has no shell, can run exactly the same code through a guarded route.
 */

import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, seedDemoData } from "../src/lib/seed";

const prisma = new PrismaClient();

seedDemoData(prisma)
  .then((counts) => {
    console.log("Seeded:", counts);
    console.log(`\nSign in with any of these — password: ${DEMO_PASSWORD}`);
    console.log("  inspector@example.wa.gov    Marisol Reyes, licensor (the scenario)");
    console.log("  supervisor@example.wa.gov   Dana Whitfield, field manager");
    console.log("  admin@example.wa.gov        Priya Raman, programme administrator");
    console.log("  adeline@cedargroveafh.example  provider, Cedar Grove");
    console.log("  tomas@willowcreekafh.example   provider, Willow Creek");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
