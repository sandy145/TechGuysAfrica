-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "evidence";

-- CreateTable
CREATE TABLE "evidence"."Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent" TEXT,
    "stateCode" TEXT NOT NULL DEFAULT 'WA',
    "evidenceWindowDays" INTEGER NOT NULL DEFAULT 10,
    "pocDueDays" INTEGER NOT NULL DEFAULT 10,
    "idrRequestDays" INTEGER NOT NULL DEFAULT 10,
    "correctionDays" INTEGER NOT NULL DEFAULT 45,
    "minEvidenceSources" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."Office" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "email" TEXT,
    "phone" TEXT,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'INSPECTOR',
    "title" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "agencyId" TEXT,
    "officeId" TEXT,
    "providerHomeId" TEXT,
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."LicensedHome" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "officeId" TEXT,
    "licenseNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "addressLine1" TEXT,
    "city" TEXT,
    "county" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "bedCapacity" INTEGER NOT NULL DEFAULT 6,
    "residentCount" INTEGER NOT NULL DEFAULT 0,
    "specialties" TEXT NOT NULL DEFAULT '[]',
    "licensedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicensedHome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."Inspection" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FULL',
    "surveyNumber" TEXT,
    "leadInspectorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "enteredAt" TIMESTAMP(3),
    "exitConferenceAt" TIMESTAMP(3),
    "evidenceDueAt" TIMESTAMP(3),
    "evidenceExtendedReason" TEXT,
    "sodIssuedAt" TIMESTAMP(3),
    "sodAcknowledgedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "scopeNote" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."Finding" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "wacCite" TEXT NOT NULL,
    "requirementText" TEXT NOT NULL,
    "practiceText" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ISOLATED',
    "harm" TEXT NOT NULL DEFAULT 'POTENTIAL_HARM',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "evidenceDueAt" TIMESTAMP(3),
    "createdById" TEXT,
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."EvidenceSource" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "gatheredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."EvidenceRequest" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."Submission" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "evidenceRequestId" TEXT,
    "note" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."SubmissionFile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "firstOpenedAt" TIMESTAMP(3),
    "firstOpenedById" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."FindingNote" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "authorId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'SHARED',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."Determination" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidenceConsideredJson" TEXT NOT NULL DEFAULT '[]',
    "noProviderResponse" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Determination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."Citation" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "pocDueAt" TIMESTAMP(3),
    "correctionDueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING_POC',
    "enforcementJson" TEXT NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMP(3),
    "verifiedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."PlanOfCorrection" (
    "id" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "howCorrected" TEXT NOT NULL,
    "systemicMeasures" TEXT NOT NULL,
    "responsiblePerson" TEXT NOT NULL,
    "completionDate" TIMESTAMP(3),
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "PlanOfCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."IdrRequest" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TRADITIONAL',
    "findingIdsJson" TEXT NOT NULL DEFAULT '[]',
    "statement" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "scheduledAt" TIMESTAMP(3),
    "outcome" TEXT,
    "outcomeNote" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "IdrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "summary" TEXT NOT NULL,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."OutboxMessage" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."FileBlob" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Office_agencyId_idx" ON "evidence"."Office"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "evidence"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "evidence"."User"("inviteToken");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "evidence"."User"("role");

-- CreateIndex
CREATE INDEX "User_providerHomeId_idx" ON "evidence"."User"("providerHomeId");

-- CreateIndex
CREATE INDEX "User_officeId_idx" ON "evidence"."User"("officeId");

-- CreateIndex
CREATE UNIQUE INDEX "LicensedHome_licenseNumber_key" ON "evidence"."LicensedHome"("licenseNumber");

-- CreateIndex
CREATE INDEX "LicensedHome_agencyId_idx" ON "evidence"."LicensedHome"("agencyId");

-- CreateIndex
CREATE INDEX "LicensedHome_county_idx" ON "evidence"."LicensedHome"("county");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_surveyNumber_key" ON "evidence"."Inspection"("surveyNumber");

-- CreateIndex
CREATE INDEX "Inspection_homeId_status_idx" ON "evidence"."Inspection"("homeId", "status");

-- CreateIndex
CREATE INDEX "Inspection_leadInspectorId_idx" ON "evidence"."Inspection"("leadInspectorId");

-- CreateIndex
CREATE INDEX "Inspection_evidenceDueAt_idx" ON "evidence"."Inspection"("evidenceDueAt");

-- CreateIndex
CREATE INDEX "Finding_inspectionId_status_idx" ON "evidence"."Finding"("inspectionId", "status");

-- CreateIndex
CREATE INDEX "Finding_status_idx" ON "evidence"."Finding"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_inspectionId_tag_key" ON "evidence"."Finding"("inspectionId", "tag");

-- CreateIndex
CREATE INDEX "EvidenceSource_findingId_idx" ON "evidence"."EvidenceSource"("findingId");

-- CreateIndex
CREATE INDEX "EvidenceRequest_findingId_status_idx" ON "evidence"."EvidenceRequest"("findingId", "status");

-- CreateIndex
CREATE INDEX "Submission_findingId_reviewedAt_idx" ON "evidence"."Submission"("findingId", "reviewedAt");

-- CreateIndex
CREATE INDEX "Submission_submittedAt_idx" ON "evidence"."Submission"("submittedAt");

-- CreateIndex
CREATE INDEX "SubmissionFile_submissionId_idx" ON "evidence"."SubmissionFile"("submissionId");

-- CreateIndex
CREATE INDEX "FindingNote_findingId_createdAt_idx" ON "evidence"."FindingNote"("findingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Determination_findingId_key" ON "evidence"."Determination"("findingId");

-- CreateIndex
CREATE INDEX "Determination_outcome_idx" ON "evidence"."Determination"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "Citation_findingId_key" ON "evidence"."Citation"("findingId");

-- CreateIndex
CREATE INDEX "PlanOfCorrection_citationId_idx" ON "evidence"."PlanOfCorrection"("citationId");

-- CreateIndex
CREATE INDEX "IdrRequest_inspectionId_status_idx" ON "evidence"."IdrRequest"("inspectionId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_inspectionId_createdAt_idx" ON "evidence"."AuditEvent"("inspectionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "evidence"."AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "evidence"."AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OutboxMessage_status_createdAt_idx" ON "evidence"."OutboxMessage"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "evidence"."Office" ADD CONSTRAINT "Office_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "evidence"."Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "evidence"."Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."User" ADD CONSTRAINT "User_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "evidence"."Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."User" ADD CONSTRAINT "User_providerHomeId_fkey" FOREIGN KEY ("providerHomeId") REFERENCES "evidence"."LicensedHome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."LicensedHome" ADD CONSTRAINT "LicensedHome_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "evidence"."Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."LicensedHome" ADD CONSTRAINT "LicensedHome_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "evidence"."Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Inspection" ADD CONSTRAINT "Inspection_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "evidence"."LicensedHome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Inspection" ADD CONSTRAINT "Inspection_leadInspectorId_fkey" FOREIGN KEY ("leadInspectorId") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Finding" ADD CONSTRAINT "Finding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "evidence"."Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Finding" ADD CONSTRAINT "Finding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."EvidenceSource" ADD CONSTRAINT "EvidenceSource_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "evidence"."Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "evidence"."Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Submission" ADD CONSTRAINT "Submission_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "evidence"."Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Submission" ADD CONSTRAINT "Submission_evidenceRequestId_fkey" FOREIGN KEY ("evidenceRequestId") REFERENCES "evidence"."EvidenceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Submission" ADD CONSTRAINT "Submission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Submission" ADD CONSTRAINT "Submission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."SubmissionFile" ADD CONSTRAINT "SubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "evidence"."Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."FindingNote" ADD CONSTRAINT "FindingNote_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "evidence"."Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."FindingNote" ADD CONSTRAINT "FindingNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Determination" ADD CONSTRAINT "Determination_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "evidence"."Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Determination" ADD CONSTRAINT "Determination_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Determination" ADD CONSTRAINT "Determination_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."Citation" ADD CONSTRAINT "Citation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "evidence"."Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."PlanOfCorrection" ADD CONSTRAINT "PlanOfCorrection_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "evidence"."Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."PlanOfCorrection" ADD CONSTRAINT "PlanOfCorrection_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."IdrRequest" ADD CONSTRAINT "IdrRequest_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "evidence"."Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."IdrRequest" ADD CONSTRAINT "IdrRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "evidence"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."AuditEvent" ADD CONSTRAINT "AuditEvent_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "evidence"."Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

