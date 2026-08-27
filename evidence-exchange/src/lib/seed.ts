/**
 * The demonstration scenario.
 *
 * Deliberately the one this product was built for: a full inspection whose
 * exit conference has happened, whose evidence window is running, and which
 * contains a finding where the provider has already sent the document that
 * resolves it — sitting unreviewed. On the licensor's dashboard that finding is
 * the loudest thing on the screen, which is the entire difference between this
 * and an inbox.
 *
 * Lives under src/ rather than prisma/ so it can be run two ways: by the CLI
 * (`npm run db:seed`) against a local database, and by the guarded seed route
 * against a hosted one where there is no shell.
 */

import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export const DEMO_PASSWORD = "Exchange2026!";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

/** Wipe and re-seed. Returns the row counts for the caller to report. */
export async function seedDemoData(prisma: PrismaClient) {
  // Order matters: children first.
  await prisma.fileBlob.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.outboxMessage.deleteMany();
  await prisma.planOfCorrection.deleteMany();
  await prisma.citation.deleteMany();
  await prisma.determination.deleteMany();
  await prisma.submissionFile.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.evidenceRequest.deleteMany();
  await prisma.evidenceSource.deleteMany();
  await prisma.findingNote.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.idrRequest.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.user.deleteMany();
  await prisma.licensedHome.deleteMany();
  await prisma.office.deleteMany();
  await prisma.agency.deleteMany();

  const agency = await prisma.agency.create({
    data: {
      name: "Residential Care Services",
      parent: "Department of Social and Health Services",
      stateCode: "WA",
    },
  });

  const office = await prisma.office.create({
    data: {
      agencyId: agency.id,
      name: "Region 2 — King County field office",
      region: "Region 2",
      email: "region2.afh@example.wa.gov",
      phone: "(206) 555-0142",
    },
  });

  const pass = hashPassword(DEMO_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.wa.gov",
      name: "Priya Raman",
      role: "AGENCY_ADMIN",
      title: "Program administrator",
      passwordHash: pass,
      agencyId: agency.id,
      officeId: office.id,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      email: "supervisor@example.wa.gov",
      name: "Dana Whitfield",
      role: "SUPERVISOR",
      title: "Field manager",
      passwordHash: pass,
      agencyId: agency.id,
      officeId: office.id,
    },
  });

  const inspector = await prisma.user.create({
    data: {
      email: "inspector@example.wa.gov",
      name: "Marisol Reyes",
      role: "INSPECTOR",
      title: "Residential care licensor",
      phone: "(206) 555-0188",
      passwordHash: pass,
      agencyId: agency.id,
      officeId: office.id,
    },
  });

  const inspector2 = await prisma.user.create({
    data: {
      email: "inspector2@example.wa.gov",
      name: "Aaron Boyd",
      role: "INSPECTOR",
      title: "Residential care licensor",
      passwordHash: pass,
      agencyId: agency.id,
      officeId: office.id,
    },
  });

  const homes = await Promise.all(
    [
      {
        licenseNumber: "AFH-745120",
        name: "Cedar Grove Adult Family Home",
        providerName: "Adeline Okonkwo",
        addressLine1: "1420 S Cedar Grove Way",
        city: "Renton",
        county: "King",
        zip: "98055",
        phone: "(425) 555-0119",
        email: "adeline@cedargroveafh.example",
        bedCapacity: 6,
        residentCount: 5,
        specialties: JSON.stringify(["DEMENTIA"]),
        licensedAt: new Date("2019-04-11"),
      },
      {
        licenseNumber: "AFH-712884",
        name: "Willow Creek Adult Family Home",
        providerName: "Tomas Delgado",
        addressLine1: "88 Willow Creek Rd",
        city: "Kent",
        county: "King",
        zip: "98032",
        phone: "(253) 555-0170",
        email: "tomas@willowcreekafh.example",
        bedCapacity: 6,
        residentCount: 6,
        specialties: JSON.stringify(["DEMENTIA", "MENTAL_HEALTH"]),
        licensedAt: new Date("2016-09-02"),
      },
      {
        licenseNumber: "AFH-760455",
        name: "Harborview House",
        providerName: "Grace Mensah",
        addressLine1: "3307 45th Ave SW",
        city: "Seattle",
        county: "King",
        zip: "98116",
        phone: "(206) 555-0133",
        email: "grace@harborviewhouse.example",
        bedCapacity: 4,
        residentCount: 3,
        specialties: JSON.stringify([]),
        licensedAt: new Date("2022-01-18"),
      },
    ].map((h) =>
      prisma.licensedHome.create({
        data: { ...h, agencyId: agency.id, officeId: office.id },
      }),
    ),
  );

  const [cedar, willow, harbor] = homes;

  const adeline = await prisma.user.create({
    data: {
      email: "adeline@cedargroveafh.example",
      name: "Adeline Okonkwo",
      role: "PROVIDER",
      title: "Provider / licensee",
      passwordHash: pass,
      providerHomeId: cedar.id,
      invitedById: inspector.id,
      lastLoginAt: daysAgo(1),
    },
  });

  await prisma.user.create({
    data: {
      email: "tomas@willowcreekafh.example",
      name: "Tomas Delgado",
      role: "PROVIDER",
      title: "Provider / licensee",
      passwordHash: pass,
      providerHomeId: willow.id,
      invitedById: inspector2.id,
      lastLoginAt: daysAgo(4),
    },
  });

  // An invitation that has been sent but not yet accepted, so the invite flow
  // is visible without having to run it first.
  await prisma.user.create({
    data: {
      email: "grace@harborviewhouse.example",
      name: "Grace Mensah",
      role: "PROVIDER",
      title: "Provider / licensee",
      providerHomeId: harbor.id,
      invitedById: inspector.id,
      inviteToken: "demo-invite-harborview",
      inviteExpiresAt: daysFromNow(12),
    },
  });

  // -------------------------------------------------------------------------
  // Inspection 1 — Cedar Grove. The scenario.
  // -------------------------------------------------------------------------

  const exitAt = daysAgo(6);
  const cedarInspection = await prisma.inspection.create({
    data: {
      homeId: cedar.id,
      type: "FULL",
      surveyNumber: "2026-K2-00418",
      leadInspectorId: inspector.id,
      status: "EVIDENCE_OPEN",
      enteredAt: daysAgo(7),
      exitConferenceAt: exitAt,
      evidenceDueAt: daysFromNow(4),
      scopeNote:
        "Full inspection. Resident sample of three, staff sample of three, medication pass observed at 0800.",
    },
  });

  type FindingSeed = {
    tag: string;
    cite: string;
    requirement: string;
    practice: string;
    scope: string;
    harm: string;
    status: string;
    sources: { kind: string; detail: string }[];
    request?: string;
    submissions?: {
      note: string;
      daysAgo: number;
      reviewed: boolean;
      opened: boolean;
      files: { name: string; size: number }[];
    }[];
    determination?: {
      outcome: string;
      rationale: string;
      noResponse?: boolean;
    };
  };

  const cedarFindings: FindingSeed[] = [
    {
      tag: "F-01",
      cite: "WAC 388-76-10425",
      requirement:
        "Staff with direct resident contact must hold current CPR and first-aid certification.",
      practice:
        "The staff file for caregiver R.T. contained no CPR card current as of the date of survey. The provider stated a card existed but could not produce it during the inspection.",
      scope: "ISOLATED",
      harm: "POTENTIAL_HARM",
      status: "EVIDENCE_RECEIVED",
      sources: [
        { kind: "RECORD_REVIEW", detail: "Staff file review, caregiver R.T., reviewed onsite." },
        {
          kind: "INTERVIEW",
          detail: "Provider interview: stated the renewal class was taken but the card was not in the file.",
        },
      ],
      request:
        "Provide the CPR and first-aid certification in effect for caregiver R.T. on the date of survey, plus the roster or completion record from the training provider.",
      submissions: [
        {
          note:
            "Attaching R.T.'s CPR card (renewed March 3) and the class roster from the training centre. The card was in the binder in the back office, not the staff file — I have moved it.",
          daysAgo: 4,
          reviewed: false,
          opened: false,
          files: [
            { name: "RT-CPR-card-2026-03-03.pdf", size: 412_331 },
            { name: "training-roster-march.pdf", size: 208_774 },
          ],
        },
      ],
    },
    {
      tag: "F-02",
      cite: "WAC 388-76-10395",
      requirement:
        "Medications must be assisted with or administered only as permitted, and accurately documented.",
      practice:
        "Two evening entries on the March medication log for resident #2 were blank with no late-entry note.",
      scope: "ISOLATED",
      harm: "NO_HARM",
      status: "DETERMINED",
      sources: [
        { kind: "RECORD_REVIEW", detail: "March medication log, resident #2." },
        { kind: "INTERVIEW", detail: "Caregiver interview describing the evening documentation routine." },
      ],
      request: "Provide the March medication log and any late-entry documentation for the two evening doses.",
      submissions: [
        {
          note: "Log pages attached. The doses were given; the caregiver initialled the wrong column.",
          daysAgo: 5,
          reviewed: true,
          opened: true,
          files: [{ name: "march-mar-resident2.pdf", size: 656_012 }],
        },
      ],
      determination: {
        outcome: "CONSULTATION",
        rationale:
          "The submitted log confirms the medications were given; the failure was documentation placement, not administration. No resident outcome. Technical assistance provided on late-entry documentation and column use; provider is retraining staff this month.",
      },
    },
    {
      tag: "F-03",
      cite: "WAC 388-76-10175",
      requirement:
        "Staff must complete specialty training within the required timeframe when the home serves residents with a specialty designation.",
      practice:
        "Two caregivers hired in January had no record of dementia specialty training completion at the time of survey.",
      scope: "PATTERN",
      harm: "POTENTIAL_HARM",
      status: "PENDING_EVIDENCE",
      sources: [
        { kind: "RECORD_REVIEW", detail: "Staff files for two caregivers hired 01/2026." },
        { kind: "INTERVIEW", detail: "Provider interview regarding the training schedule." },
      ],
      request:
        "Provide dementia specialty training certificates for both caregivers hired in January, or the enrolment record showing the completion date.",
    },
    {
      tag: "F-04",
      cite: "WAC 388-76-10515",
      requirement: "The home must maintain a current disaster plan and practice evacuation drills.",
      practice:
        "The disaster plan on the wall listed a former resident manager and a disconnected phone number.",
      scope: "ISOLATED",
      harm: "POTENTIAL_HARM",
      status: "DETERMINED",
      sources: [
        { kind: "OBSERVATION", detail: "Posted disaster plan observed during the inspection tour." },
      ],
      request: "Provide the current disaster plan and the last two evacuation drill records.",
      submissions: [
        {
          note:
            "The updated plan was posted in the kitchen — the one you saw in the hall was the old copy, which I have removed. Drill records for January and March attached.",
          daysAgo: 5,
          reviewed: true,
          opened: true,
          files: [
            { name: "disaster-plan-updated-2026-02.pdf", size: 1_204_882 },
            { name: "drill-records-jan-mar.pdf", size: 331_006 },
          ],
        },
      ],
      determination: {
        outcome: "NO_DEFICIENCY",
        rationale:
          "The current plan was in place and posted in the kitchen on the date of survey, with drills documented in January and March. The outdated copy in the hall has been removed. The requirement was met.",
      },
    },
    {
      tag: "F-05",
      cite: "WAC 388-76-10740",
      requirement:
        "Smoke detectors and fire extinguishers must be present, current, and in working order.",
      practice:
        "The kitchen extinguisher carried a service tag dated 22 months before the survey, and the hallway detector did not sound when tested.",
      scope: "ISOLATED",
      harm: "ACTUAL_HARM",
      status: "DETERMINED",
      sources: [
        { kind: "OBSERVATION", detail: "Extinguisher service tag observed; hallway detector tested and did not sound." },
        { kind: "PHOTO", detail: "Photograph of the extinguisher service tag." },
        { kind: "INTERVIEW", detail: "Provider confirmed no service had been scheduled." },
      ],
      request:
        "Provide the extinguisher service record and any documentation of smoke detector testing since the last inspection.",
      submissions: [
        {
          note: "The extinguisher was serviced two days after your visit — receipt attached. I have no testing log for the detector.",
          daysAgo: 3,
          reviewed: true,
          opened: true,
          files: [{ name: "extinguisher-service-receipt.pdf", size: 145_223 }],
        },
      ],
      determination: {
        outcome: "CITATION",
        rationale:
          "The evidence submitted confirms service occurred after the survey rather than before it, and no detector testing record exists for the period. The condition was present on the date of survey with a non-functioning detector in a hallway serving three resident rooms. Correction after the fact does not remove the deficiency.",
      },
    },
  ];

  for (const seed of cedarFindings) {
    const finding = await prisma.finding.create({
      data: {
        inspectionId: cedarInspection.id,
        tag: seed.tag,
        wacCite: seed.cite,
        requirementText: seed.requirement,
        practiceText: seed.practice,
        scope: seed.scope,
        harm: seed.harm,
        status: seed.status,
        createdById: inspector.id,
        sharedAt: exitAt,
        evidenceDueAt: daysFromNow(4),
        sources: {
          create: seed.sources.map((s) => ({ ...s, gatheredAt: daysAgo(7) })),
        },
      },
    });

    let requestId: string | null = null;
    if (seed.request) {
      const req = await prisma.evidenceRequest.create({
        data: {
          findingId: finding.id,
          prompt: seed.request,
          dueAt: daysFromNow(4),
          requestedById: inspector.id,
          status: seed.submissions?.length ? "ANSWERED" : "OPEN",
          createdAt: exitAt,
        },
      });
      requestId = req.id;
    }

    for (const sub of seed.submissions ?? []) {
      const submission = await prisma.submission.create({
        data: {
          findingId: finding.id,
          evidenceRequestId: requestId,
          note: sub.note,
          submittedById: adeline.id,
          submittedAt: daysAgo(sub.daysAgo),
          isLate: false,
          reviewedAt: sub.reviewed ? daysAgo(sub.daysAgo - 1) : null,
          reviewedById: sub.reviewed ? inspector.id : null,
          files: {
            create: sub.files.map((f) => ({
              fileName: f.name,
              // Seeded metadata only — no bytes on disk. The download route
              // reports a missing file rather than pretending to serve one.
              storageKey: `seed/${crypto.randomBytes(8).toString("hex")}.pdf`,
              mimeType: "application/pdf",
              sizeBytes: f.size,
              sha256: crypto.randomBytes(32).toString("hex"),
              firstOpenedAt: sub.opened ? daysAgo(sub.daysAgo - 1) : null,
              firstOpenedById: sub.opened ? inspector.id : null,
              openCount: sub.opened ? 2 : 0,
            })),
          },
        },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: adeline.id,
          actorRole: "PROVIDER",
          actorName: adeline.name,
          action: "SUBMISSION_RECEIVED",
          entityType: "Submission",
          entityId: submission.id,
          inspectionId: cedarInspection.id,
          summary: `Provider submitted ${sub.files.length} file(s) for ${seed.tag}.`,
          createdAt: daysAgo(sub.daysAgo),
        },
      });
    }

    if (seed.determination) {
      const submissions = await prisma.submission.findMany({
        where: { findingId: finding.id },
        include: { files: true },
      });
      const determination = await prisma.determination.create({
        data: {
          findingId: finding.id,
          outcome: seed.determination.outcome,
          rationale: seed.determination.rationale,
          noProviderResponse: seed.determination.noResponse ?? false,
          decidedById: inspector.id,
          decidedAt: daysAgo(2),
          evidenceConsideredJson: JSON.stringify(
            submissions.map((s) => ({
              submissionId: s.id,
              submittedAt: s.submittedAt.toISOString(),
              reviewedAt: s.reviewedAt?.toISOString() ?? null,
              isLate: s.isLate,
              files: s.files.map((f) => ({
                id: f.id,
                fileName: f.fileName,
                opened: Boolean(f.firstOpenedAt),
              })),
            })),
          ),
        },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: inspector.id,
          actorRole: "INSPECTOR",
          actorName: inspector.name,
          action: "DETERMINATION_RECORDED",
          entityType: "Determination",
          entityId: determination.id,
          inspectionId: cedarInspection.id,
          summary: `${seed.tag} determined: ${seed.determination.outcome}.`,
          createdAt: daysAgo(2),
        },
      });

      if (seed.determination.outcome === "CITATION") {
        await prisma.citation.create({
          data: {
            findingId: finding.id,
            status: "PENDING_POC",
          },
        });
      }
    }
  }

  await prisma.findingNote.create({
    data: {
      findingId: (await prisma.finding.findFirstOrThrow({
        where: { inspectionId: cedarInspection.id, tag: "F-01" },
      })).id,
      authorId: adeline.id,
      visibility: "SHARED",
      body:
        "I want to be sure this was received — last time I sent documents by email and they were not seen before the report went out.",
      createdAt: daysAgo(4),
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        actorId: inspector.id,
        actorRole: "INSPECTOR",
        actorName: inspector.name,
        action: "INSPECTION_CREATED",
        entityType: "Inspection",
        entityId: cedarInspection.id,
        inspectionId: cedarInspection.id,
        summary: "Full inspection opened for Cedar Grove Adult Family Home.",
        createdAt: daysAgo(7),
      },
      {
        actorId: inspector.id,
        actorRole: "INSPECTOR",
        actorName: inspector.name,
        action: "EXIT_CONFERENCE_RECORDED",
        entityType: "Inspection",
        entityId: cedarInspection.id,
        inspectionId: cedarInspection.id,
        summary: "Exit conference held; five preliminary findings shared with the provider.",
        createdAt: exitAt,
      },
      {
        actorId: inspector.id,
        actorRole: "INSPECTOR",
        actorName: inspector.name,
        action: "EVIDENCE_WINDOW_OPENED",
        entityType: "Inspection",
        entityId: cedarInspection.id,
        inspectionId: cedarInspection.id,
        summary: "Evidence window opened; provider notified.",
        createdAt: exitAt,
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Inspection 2 — Willow Creek. Past the statement of deficiencies, with a
  // plan of correction in flight and a disputed citation in review.
  // -------------------------------------------------------------------------

  const willowInspection = await prisma.inspection.create({
    data: {
      homeId: willow.id,
      type: "COMPLAINT",
      surveyNumber: "2026-K2-00392",
      leadInspectorId: inspector2.id,
      status: "POC_REVIEW",
      enteredAt: daysAgo(41),
      exitConferenceAt: daysAgo(40),
      evidenceDueAt: daysAgo(26),
      sodIssuedAt: daysAgo(20),
      sodAcknowledgedAt: daysAgo(19),
      scopeNote: "Complaint investigation: allegation of unmet call-light response at night.",
      summary:
        "Two of three allegations were unsubstantiated on the evidence submitted. One citation issued for staffing documentation.",
    },
  });

  const willowCited = await prisma.finding.create({
    data: {
      inspectionId: willowInspection.id,
      tag: "F-01",
      wacCite: "WAC 388-76-10175",
      requirementText:
        "The home must have qualified staff sufficient in number to meet resident needs at all times.",
      practiceText:
        "Night staffing records for four dates in the review period did not show who was awake and on duty.",
      scope: "PATTERN",
      harm: "POTENTIAL_HARM",
      status: "DETERMINED",
      createdById: inspector2.id,
      sharedAt: daysAgo(40),
      evidenceDueAt: daysAgo(26),
      sources: {
        create: [
          { kind: "RECORD_REVIEW", detail: "Staffing schedules and time records for the review period." },
          { kind: "INTERVIEW", detail: "Two caregiver interviews about the overnight rotation." },
        ],
      },
    },
  });

  await prisma.determination.create({
    data: {
      findingId: willowCited.id,
      outcome: "CITATION",
      rationale:
        "The records submitted covered two of the four dates. For the remaining two dates no record identifies awake staff on duty, and caregiver interviews conflict. The requirement was not met on those dates.",
      decidedById: inspector2.id,
      decidedAt: daysAgo(22),
    },
  });

  const willowCitation = await prisma.citation.create({
    data: {
      findingId: willowCited.id,
      pocDueAt: daysAgo(5),
      correctionDueAt: daysFromNow(25),
      status: "POC_SUBMITTED",
    },
  });

  const tomas = await prisma.user.findFirstOrThrow({ where: { providerHomeId: willow.id } });

  await prisma.planOfCorrection.create({
    data: {
      citationId: willowCitation.id,
      howCorrected:
        "The overnight sign-in sheet has been replaced with a bound log that records awake-staff arrival and departure, signed at both ends of the shift.",
      systemicMeasures:
        "The provider reviews the log every Monday against the posted schedule; gaps are corrected the same week and reported to the licensee.",
      responsiblePerson: "Tomas Delgado, provider",
      completionDate: daysAgo(6),
      submittedById: tomas.id,
      submittedAt: daysAgo(6),
      status: "SUBMITTED",
    },
  });

  await prisma.idrRequest.create({
    data: {
      inspectionId: willowInspection.id,
      type: "TRADITIONAL",
      findingIdsJson: JSON.stringify([willowCited.id]),
      statement:
        "The two dates in question were covered by the on-call substitute, whose hours appear on the payroll export rather than the schedule. That export was sent during the inspection.",
      requestedById: tomas.id,
      requestedAt: daysAgo(12),
      status: "SCHEDULED",
      scheduledAt: daysFromNow(3),
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        actorId: inspector2.id,
        actorRole: "INSPECTOR",
        actorName: inspector2.name,
        action: "SOD_ISSUED",
        entityType: "Inspection",
        entityId: willowInspection.id,
        inspectionId: willowInspection.id,
        summary: "Statement of deficiencies issued with one citation.",
        createdAt: daysAgo(20),
      },
      {
        actorId: tomas.id,
        actorRole: "PROVIDER",
        actorName: tomas.name,
        action: "SOD_ACKNOWLEDGED",
        entityType: "Inspection",
        entityId: willowInspection.id,
        inspectionId: willowInspection.id,
        summary: "Provider acknowledged receipt; plan of correction and dispute clocks started.",
        createdAt: daysAgo(19),
      },
      {
        actorId: tomas.id,
        actorRole: "PROVIDER",
        actorName: tomas.name,
        action: "IDR_REQUESTED",
        entityType: "IdrRequest",
        entityId: willowInspection.id,
        inspectionId: willowInspection.id,
        summary: "Traditional informal dispute resolution requested on F-01.",
        createdAt: daysAgo(12),
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Inspection 3 — Harborview. Onsite now, findings still in draft.
  // -------------------------------------------------------------------------

  const harborInspection = await prisma.inspection.create({
    data: {
      homeId: harbor.id,
      type: "FULL",
      surveyNumber: "2026-K2-00431",
      leadInspectorId: inspector.id,
      status: "ONSITE",
      enteredAt: new Date(),
      scopeNote: "Full inspection in progress.",
    },
  });

  await prisma.finding.create({
    data: {
      inspectionId: harborInspection.id,
      tag: "F-01",
      wacCite: "WAC 388-76-10375",
      requirementText:
        "A negotiated care plan must be developed with the resident and kept current as needs change.",
      practiceText:
        "Draft: care plan for resident #1 not updated after the February hospitalisation. Needs a second source before it is shared.",
      scope: "ISOLATED",
      harm: "POTENTIAL_HARM",
      status: "DRAFT",
      createdById: inspector.id,
      sources: {
        create: [{ kind: "RECORD_REVIEW", detail: "Resident #1 record, care plan section." }],
      },
    },
  });

  await prisma.outboxMessage.createMany({
    data: [
      {
        toEmail: cedar.email!,
        subject: "Cedar Grove Adult Family Home — 5 findings need documentation by " +
          daysFromNow(4).toLocaleDateString("en-US"),
        bodyHtml:
          "<p>Your inspection findings are ready for review in the Evidence Exchange. Sign in to see each finding and upload the records requested.</p>",
        kind: "FINDINGS_SHARED",
        status: "QUEUED",
        createdAt: exitAt,
      },
      {
        toEmail: "grace@harborviewhouse.example",
        subject: "You have been given access to the Evidence Exchange",
        bodyHtml: "<p>Set your password to activate your account.</p>",
        kind: "INVITATION",
        status: "QUEUED",
        createdAt: daysAgo(2),
      },
    ],
  });

  const counts = {
    homes: await prisma.licensedHome.count(),
    users: await prisma.user.count(),
    inspections: await prisma.inspection.count(),
    findings: await prisma.finding.count(),
    submissions: await prisma.submission.count(),
  };

  return counts;
}
