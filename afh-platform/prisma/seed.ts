/**
 * Seed the catalog (regulations, document types, rule checks, form templates)
 * and, unless disabled, a demo home so the dashboard has something to show.
 *
 *   npm run db:seed                    # catalog + demo home + sample feed
 *   SEED_DEMO=false npm run db:seed    # catalog only — use this for real data
 *   SEED_SAMPLE_UPDATES=false ...      # catalog + demo home, no sample feed
 *
 * Safe to re-run: everything is upserted by its stable code, and demo rows are
 * cleared and rebuilt rather than duplicated.
 */

import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { SEED_REGULATIONS, regulationUrl } from "./seed-data/regulations";
import { SEED_DOCUMENT_TYPES } from "./seed-data/document-types";
import { SEED_RULE_CHECKS } from "./seed-data/rule-checks";
import { SEED_FORM_TEMPLATES } from "./seed-data/form-templates";
import { SEED_CITATIONS, SEED_UPDATES } from "./seed-data/updates";

const prisma = new PrismaClient();

const SEED_DEMO = process.env.SEED_DEMO !== "false";
const SEED_SAMPLE_UPDATES = process.env.SEED_SAMPLE_UPDATES !== "false";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo-password-123";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY);

/** Mirrors hashPassword() in src/lib/auth.ts — kept here so seeding needs no server imports. */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

async function seedCatalog(): Promise<void> {
  for (const regulation of SEED_REGULATIONS) {
    const data = {
      title: regulation.title,
      subchapter: regulation.subchapter,
      summary: regulation.summary,
      url: regulationUrl(regulation.cite),
      // Deliberately false: these are a scaffold, not checked rule text.
      verified: false,
      isActive: true,
    };
    await prisma.regulation.upsert({
      where: { cite: regulation.cite },
      // Never downgrade an entry someone has verified via wac:import.
      update: { subchapter: data.subchapter, url: data.url },
      create: { cite: regulation.cite, ...data },
    });
  }
  console.log(`  ${SEED_REGULATIONS.length} regulations`);

  for (const type of SEED_DOCUMENT_TYPES) {
    const data = {
      name: type.name,
      description: type.description,
      scope: type.scope,
      category: type.category,
      wacCite: type.wacCite,
      renewalMonths: type.renewalMonths,
      warnDays: type.warnDays ?? 60,
      sortOrder: type.sortOrder,
      isSystem: true,
    };
    await prisma.documentType.upsert({
      where: { code: type.code },
      update: data,
      create: { code: type.code, ...data },
    });
  }
  console.log(`  ${SEED_DOCUMENT_TYPES.length} document types`);

  for (const check of SEED_RULE_CHECKS) {
    const regulation = check.regulationCite
      ? await prisma.regulation.findUnique({ where: { cite: check.regulationCite } })
      : null;
    const documentType = check.documentTypeCode
      ? await prisma.documentType.findUnique({ where: { code: check.documentTypeCode } })
      : null;

    if (check.documentTypeCode && !documentType) {
      console.warn(`  ! rule check ${check.code} references unknown document type ${check.documentTypeCode}`);
      continue;
    }

    const data = {
      regulationId: regulation?.id ?? null,
      documentTypeId: documentType?.id ?? null,
      title: check.title,
      description: check.description ?? null,
      severity: check.severity,
      checkType: check.checkType,
      appliesWhenJson: JSON.stringify(check.appliesWhen ?? {}),
      subjectWhenJson: JSON.stringify(check.subjectWhen ?? {}),
      paramsJson: JSON.stringify(check.params ?? {}),
      remediation: check.remediation,
      isActive: true,
    };
    await prisma.ruleCheck.upsert({
      where: { code: check.code },
      update: data,
      create: { code: check.code, ...data },
    });
  }
  console.log(`  ${SEED_RULE_CHECKS.length} rule checks`);

  for (const template of SEED_FORM_TEMPLATES) {
    const data = {
      title: template.title,
      description: template.description,
      category: template.category,
      wacCite: template.wacCite,
      subjectType: template.subjectType,
      fieldsJson: JSON.stringify(template.fields),
      bodyTemplate: template.body,
      signersJson: JSON.stringify(template.signers),
      documentTypeCode: template.documentTypeCode,
      isSystem: true,
    };
    await prisma.formTemplate.upsert({
      where: { code: template.code },
      update: data,
      create: { code: template.code, ...data },
    });
  }
  console.log(`  ${SEED_FORM_TEMPLATES.length} form templates`);
}

async function seedUpdates(): Promise<void> {
  // Sample rows carry no natural key, so clear the sample-sourced ones first
  // to keep re-runs from stacking duplicates.
  await prisma.regulatoryUpdate.deleteMany({ where: { source: SAMPLE_SOURCE } });

  for (const update of SEED_UPDATES) {
    const regulation = update.regulationCite
      ? await prisma.regulation.findUnique({ where: { cite: update.regulationCite } })
      : null;

    await prisma.regulatoryUpdate.create({
      data: {
        title: update.title,
        summary: update.summary,
        body: update.body,
        kind: update.kind,
        severity: update.severity,
        source: SAMPLE_SOURCE,
        url: regulation?.url ?? null,
        regulationId: regulation?.id ?? null,
        ruleCheckCodesJson: JSON.stringify(update.ruleCheckCodes),
        publishedAt: daysAgo(update.daysAgo),
        effectiveAt: update.effectiveInDays ? daysAhead(update.effectiveInDays) : null,
      },
    });
  }
  console.log(`  ${SEED_UPDATES.length} sample rule updates`);
}

const SAMPLE_SOURCE = "Sample data shipped with the platform — not a real notice";
const SAMPLE_AUTHOR_HASH = "sample-seed-author";

async function seedCitations(): Promise<void> {
  await prisma.citation.deleteMany({ where: { authorHash: SAMPLE_AUTHOR_HASH } });

  for (const citation of SEED_CITATIONS) {
    const regulation = await prisma.regulation.findUnique({
      where: { cite: citation.wacCite },
    });
    const posted = daysAgo(citation.daysAgo);
    const quarter = `${posted.getFullYear()}-Q${Math.floor(posted.getMonth() / 3) + 1}`;

    await prisma.citation.create({
      data: {
        // No homeId: sample posts are not attributable to anyone.
        authorHash: SAMPLE_AUTHOR_HASH,
        county: citation.county,
        bedSizeBucket: citation.bedSizeBucket,
        surveyType: citation.surveyType,
        citedQuarter: quarter,
        regulationId: regulation?.id ?? null,
        wacCite: citation.wacCite,
        severity: citation.severity,
        summary: citation.summary,
        narrative: citation.narrative,
        correctiveAction: citation.correctiveAction,
        fineAmount: citation.fineAmount ?? null,
        tagsJson: JSON.stringify(citation.tags),
        status: "APPROVED",
        helpfulCount: Math.max(0, 12 - Math.floor(citation.daysAgo / 8)),
        createdAt: posted,
      },
    });
  }
  console.log(`  ${SEED_CITATIONS.length} sample citations`);
}

async function seedDemoHome(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing?.homeId) {
    // Rebuild from scratch so the demo always shows the same illustrative mix.
    await prisma.home.delete({ where: { id: existing.homeId } });
  }
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const home = await prisma.home.create({
    data: {
      name: "Cedar Grove Adult Family Home",
      licenseNumber: "AFH-DEMO-0001",
      addressLine1: "1420 Maple Street",
      city: "Tacoma",
      county: "Pierce",
      zip: "98402",
      phone: "(253) 555-0140",
      bedCapacity: 6,
      specialties: JSON.stringify(["DEMENTIA"]),
      providerIsResident: true,
      hasResidentManager: false,
      employsStaff: true,
      servesMedicaid: true,
      usesNurseDelegation: true,
      multipleFacilities: false,
      licensedAt: daysAgo(1500),
    },
  });

  await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo Provider",
      // ADMIN so the demo login can also reach moderation and the digest runner.
      role: "ADMIN",
      passwordHash: hashPassword(DEMO_PASSWORD),
      homeId: home.id,
    },
  });

  const residents = await Promise.all([
    prisma.resident.create({
      data: {
        homeId: home.id,
        firstName: "Ana",
        lastName: "Reyes",
        dateOfBirth: new Date("1938-03-14"),
        admittedAt: daysAgo(420),
        hasDementiaDiagnosis: true,
        isMedicaid: true,
      },
    }),
    prisma.resident.create({
      data: {
        homeId: home.id,
        firstName: "David",
        lastName: "Petrov",
        dateOfBirth: new Date("1945-11-02"),
        // Recent admission: exercises the "within 30 days of admission" checks.
        admittedAt: daysAgo(12),
        hasMentalHealthDiagnosis: true,
      },
    }),
    prisma.resident.create({
      data: {
        homeId: home.id,
        firstName: "Margaret",
        lastName: "Oyelaran",
        dateOfBirth: new Date("1941-07-28"),
        admittedAt: daysAgo(900),
        selfAdministersMedication: true,
        isMedicaid: true,
      },
    }),
  ]);

  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        homeId: home.id,
        firstName: "Grace",
        lastName: "Mensah",
        role: "PROVIDER",
        hiredAt: daysAgo(1500),
        credentialNumber: "HM60123456",
        email: "grace@example.com",
      },
    }),
    prisma.employee.create({
      data: {
        homeId: home.id,
        firstName: "Tomas",
        lastName: "Lindqvist",
        role: "CAREGIVER",
        hiredAt: daysAgo(310),
        credentialNumber: "HM60987654",
      },
    }),
    prisma.employee.create({
      data: {
        homeId: home.id,
        firstName: "Priya",
        lastName: "Raman",
        role: "SUBSTITUTE",
        // Hired recently and missing paperwork — the most common real gap.
        hiredAt: daysAgo(9),
      },
    }),
  ]);

  await prisma.home.update({
    where: { id: home.id },
    data: { residentCount: residents.length },
  });

  // A deliberately mixed set: some current, one expiring, one expired, and
  // several absent, so the dashboard shows every finding state on first load.
  const types = await prisma.documentType.findMany();
  const typeId = (code: string) => types.find((t) => t.code === code)?.id;

  type DocSpec = {
    code: string;
    title?: string;
    residentId?: string;
    employeeId?: string;
    issuedDaysAgo: number;
    expiresInDays?: number;
  };

  const docs: DocSpec[] = [
    // Home records — mostly in order.
    { code: "afh_license", issuedDaysAgo: 300, expiresInDays: 65 },
    { code: "business_license", issuedDaysAgo: 200, expiresInDays: 165 },
    { code: "liability_insurance", issuedDaysAgo: 100, expiresInDays: 265 },
    { code: "policies_procedures", issuedDaysAgo: 400 },
    { code: "infection_control_plan", issuedDaysAgo: 120 },
    { code: "staffing_schedule", issuedDaysAgo: 10 },
    // Expired: fire inspection lapsed.
    { code: "fire_safety_inspection", issuedDaysAgo: 400, expiresInDays: -35 },
    // Expiring: disaster plan due for review.
    { code: "disaster_plan", issuedDaysAgo: 330, expiresInDays: 35 },
    { code: "medicaid_contract", issuedDaysAgo: 150, expiresInDays: 215 },
    { code: "specialty_designation", issuedDaysAgo: 1400 },
    // Missing on purpose: evacuation_drill_log.

    // Ana — long-standing resident, file in reasonable order.
    { code: "admission_agreement", residentId: residents[0].id, issuedDaysAgo: 420 },
    { code: "disclosure_of_services", residentId: residents[0].id, issuedDaysAgo: 420 },
    { code: "resident_rights_ack", residentId: residents[0].id, issuedDaysAgo: 420 },
    { code: "resident_assessment", residentId: residents[0].id, issuedDaysAgo: 60, expiresInDays: 305 },
    { code: "negotiated_care_plan", residentId: residents[0].id, issuedDaysAgo: 60, expiresInDays: 305 },
    { code: "physician_orders", residentId: residents[0].id, issuedDaysAgo: 80, expiresInDays: 285 },
    { code: "medication_record", residentId: residents[0].id, issuedDaysAgo: 5, expiresInDays: 25 },
    { code: "resident_tb_screening", residentId: residents[0].id, issuedDaysAgo: 418 },
    { code: "health_care_directive", residentId: residents[0].id, issuedDaysAgo: 415 },
    { code: "resident_funds_record", residentId: residents[0].id, issuedDaysAgo: 40, expiresInDays: 325 },
    // Missing on purpose: dementia_care_plan_addendum, nurse_delegation_consent.

    // David — admitted 12 days ago, paperwork still coming together.
    { code: "admission_agreement", residentId: residents[1].id, issuedDaysAgo: 12 },
    { code: "resident_rights_ack", residentId: residents[1].id, issuedDaysAgo: 12 },
    { code: "medication_record", residentId: residents[1].id, issuedDaysAgo: 3, expiresInDays: 27 },
    // Missing: assessment, care plan, TB screening, orders, disclosure.

    // Margaret — self-administers, so a different rule set applies.
    { code: "admission_agreement", residentId: residents[2].id, issuedDaysAgo: 900 },
    { code: "disclosure_of_services", residentId: residents[2].id, issuedDaysAgo: 900 },
    { code: "resident_rights_ack", residentId: residents[2].id, issuedDaysAgo: 900 },
    { code: "resident_assessment", residentId: residents[2].id, issuedDaysAgo: 200, expiresInDays: 165 },
    { code: "negotiated_care_plan", residentId: residents[2].id, issuedDaysAgo: 200, expiresInDays: 165 },
    { code: "physician_orders", residentId: residents[2].id, issuedDaysAgo: 190, expiresInDays: 175 },
    { code: "resident_tb_screening", residentId: residents[2].id, issuedDaysAgo: 898 },
    { code: "health_care_directive", residentId: residents[2].id, issuedDaysAgo: 890 },
    { code: "resident_funds_record", residentId: residents[2].id, issuedDaysAgo: 30, expiresInDays: 335 },
    // Missing on purpose: med_self_admin_assessment.

    // Grace — the provider, file complete.
    { code: "background_check", employeeId: employees[0].id, issuedDaysAgo: 200, expiresInDays: 530 },
    { code: "employee_tb_screening", employeeId: employees[0].id, issuedDaysAgo: 90, expiresInDays: 275 },
    { code: "hca_credential", employeeId: employees[0].id, issuedDaysAgo: 100, expiresInDays: 265 },
    { code: "cpr_first_aid", employeeId: employees[0].id, issuedDaysAgo: 300, expiresInDays: 430 },
    { code: "hiv_aids_training", employeeId: employees[0].id, issuedDaysAgo: 1400 },
    { code: "food_worker_card", employeeId: employees[0].id, issuedDaysAgo: 300, expiresInDays: 430 },
    { code: "orientation_record", employeeId: employees[0].id, issuedDaysAgo: 1498 },
    { code: "continuing_education", employeeId: employees[0].id, issuedDaysAgo: 60, expiresInDays: 305 },
    { code: "job_description_signed", employeeId: employees[0].id, issuedDaysAgo: 1500 },
    { code: "specialty_dementia_training", employeeId: employees[0].id, issuedDaysAgo: 1400 },
    { code: "nurse_delegation_training", employeeId: employees[0].id, issuedDaysAgo: 800 },

    // Tomas — one credential about to lapse.
    { code: "background_check", employeeId: employees[1].id, issuedDaysAgo: 310, expiresInDays: 420 },
    { code: "employee_tb_screening", employeeId: employees[1].id, issuedDaysAgo: 305, expiresInDays: 60 },
    { code: "hca_credential", employeeId: employees[1].id, issuedDaysAgo: 320, expiresInDays: 40 },
    { code: "cpr_first_aid", employeeId: employees[1].id, issuedDaysAgo: 500, expiresInDays: 230 },
    { code: "hiv_aids_training", employeeId: employees[1].id, issuedDaysAgo: 310 },
    { code: "orientation_record", employeeId: employees[1].id, issuedDaysAgo: 309 },
    { code: "job_description_signed", employeeId: employees[1].id, issuedDaysAgo: 310 },
    { code: "specialty_dementia_training", employeeId: employees[1].id, issuedDaysAgo: 300 },
    { code: "continuing_education", employeeId: employees[1].id, issuedDaysAgo: 200, expiresInDays: 165 },
    // Missing on purpose: food_worker_card, nurse_delegation_training.

    // Priya — new substitute, almost nothing on file. This is the scenario in
    // the sample citation about substitutes, so the board and the dashboard
    // tell the same story.
    { code: "employee_tb_screening", employeeId: employees[2].id, issuedDaysAgo: 8, expiresInDays: 357 },
    // Missing: background check, credential, CPR, HIV training, orientation, etc.
  ];

  let created = 0;
  for (const spec of docs) {
    const documentTypeId = typeId(spec.code);
    if (!documentTypeId) {
      console.warn(`  ! demo document references unknown type ${spec.code}`);
      continue;
    }
    const type = types.find((t) => t.code === spec.code);

    await prisma.document.create({
      data: {
        homeId: home.id,
        documentTypeId,
        residentId: spec.residentId ?? null,
        employeeId: spec.employeeId ?? null,
        title: spec.title ?? type?.name ?? spec.code,
        fileName: null,
        // No bytes on disk: these are record stubs so the engine has something
        // to evaluate. Real documents get a storageKey from the upload flow.
        storageKey: null,
        notes: "Demo record — no file attached.",
        issuedAt: daysAgo(spec.issuedDaysAgo),
        expiresAt: spec.expiresInDays != null ? daysAhead(spec.expiresInDays) : null,
      },
    });
    created++;
  }

  console.log(`  demo home with ${residents.length} residents, ${employees.length} employees, ${created} document records`);
  console.log(`  sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

async function main(): Promise<void> {
  console.log("Seeding catalog…");
  await seedCatalog();

  if (SEED_SAMPLE_UPDATES) {
    console.log("Seeding sample feed…");
    await seedUpdates();
    await seedCitations();
  } else {
    console.log("Skipping sample feed (SEED_SAMPLE_UPDATES=false)");
  }

  if (SEED_DEMO) {
    console.log("Seeding demo home…");
    await seedDemoHome();
  } else {
    console.log("Skipping demo home (SEED_DEMO=false)");
  }

  console.log("\nDone.");
  console.log(
    "Reminder: the seeded WAC catalog is a scaffold marked unverified. Check every\n" +
      "citation against app.leg.wa.gov before relying on it, or bulk-load a verified\n" +
      "catalog with: npm run wac:import -- path/to/wac.json",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
