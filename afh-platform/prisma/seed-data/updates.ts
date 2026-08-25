/**
 * Sample entries for the rule-update feed.
 *
 * These are ILLUSTRATIVE, not real notices. No actual amendment to chapter
 * 388-76 WAC is being reported here — they exist so the digest, the dashboard
 * impact panel, and the "does this affect me?" check have something to run
 * against on a fresh install.
 *
 * Every entry says so in its `source` field and again in its body, and they are
 * skipped entirely when the database is seeded with SEED_SAMPLE_UPDATES=false.
 *
 * In production this table is where you record each real change as the
 * department publishes it, listing the rule-check codes it touches so every
 * subscriber's digest can evaluate the change against their own records.
 */

export type SeedUpdate = {
  title: string;
  summary: string;
  body: string;
  kind: "NEW_RULE" | "AMENDED_RULE" | "POLICY" | "GUIDANCE" | "ENFORCEMENT_TREND";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  regulationCite: string | null;
  ruleCheckCodes: string[];
  daysAgo: number;
  effectiveInDays?: number;
};

const DISCLAIMER =
  "\n\n— This is sample content shipped with the platform to demonstrate the personalised " +
  "impact check. It does not report a real change to Washington rules. Replace it with " +
  "actual notices as the department publishes them.";

export const SEED_UPDATES: SeedUpdate[] = [
  {
    title: "Negotiated care plan review after a change in condition",
    summary:
      "Sample: tightened expectations for how quickly a negotiated care plan is revisited after a significant change in a resident's condition.",
    body:
      "Homes should be able to show, for each resident, that the care plan was revisited " +
      "promptly after any significant change — a hospitalisation, a new diagnosis, a fall with " +
      "injury, or a change in cognition. Surveyors typically look for a dated plan that " +
      "postdates the event, not just an annual review." +
      DISCLAIMER,
    kind: "AMENDED_RULE",
    severity: "HIGH",
    regulationCite: "WAC 388-76-10355",
    ruleCheckCodes: ["negotiated_care_plan_current", "resident_assessment_current"],
    daysAgo: 6,
    effectiveInDays: 54,
  },
  {
    title: "Background check documentation for substitute caregivers",
    summary:
      "Sample: clarification that substitute and on-call caregivers need the same cleared background check on file as regular staff.",
    body:
      "A recurring finding is that a home has cleared checks for its regular caregivers but " +
      "nothing for the substitute who covers weekends. Anyone with unsupervised access to " +
      "residents needs their own cleared check in the file, whatever their hours." +
      DISCLAIMER,
    kind: "GUIDANCE",
    severity: "CRITICAL",
    regulationCite: "WAC 388-76-10160",
    ruleCheckCodes: ["employee_background_check"],
    daysAgo: 18,
  },
  {
    title: "Disaster plans must name resident-specific evacuation needs",
    summary:
      "Sample: a generic evacuation plan is no longer sufficient — the plan should name what each resident needs to get out safely.",
    body:
      "A plan that says 'assist residents to the assembly point' does not survive scrutiny. " +
      "The expectation is that the plan identifies who cannot manage stairs, who needs a " +
      "wheelchair or oxygen, and who may resist leaving, so a substitute caregiver reading it " +
      "cold knows what to do." +
      DISCLAIMER,
    kind: "AMENDED_RULE",
    severity: "HIGH",
    regulationCite: "WAC 388-76-10191",
    ruleCheckCodes: ["disaster_plan_current", "evacuation_drills_logged"],
    daysAgo: 34,
    effectiveInDays: 26,
  },
  {
    title: "Enforcement trend: medication records during unannounced visits",
    summary:
      "Sample: medication administration records are among the most frequently cited items on unannounced inspections.",
    body:
      "Gaps most often appear as unsigned entries, missing pages for a partial month, or a MAR " +
      "that does not match current practitioner orders. Reconciling the MAR against the orders " +
      "monthly closes most of it." +
      DISCLAIMER,
    kind: "ENFORCEMENT_TREND",
    severity: "MEDIUM",
    regulationCite: "WAC 388-76-10430",
    ruleCheckCodes: ["resident_medication_record", "resident_physician_orders"],
    daysAgo: 47,
  },
  {
    title: "Specialty designation training must predate the care",
    summary:
      "Sample: caregivers must complete specialty training before providing specialty care, not within a grace period afterwards.",
    body:
      "Where a home holds a dementia, mental health, or developmental disabilities designation, " +
      "the training certificate should be dated before the caregiver first provided that care." +
      DISCLAIMER,
    kind: "POLICY",
    severity: "HIGH",
    regulationCite: "WAC 388-76-10495",
    ruleCheckCodes: [
      "employee_dementia_training",
      "employee_mh_training",
      "employee_dd_training",
      "specialty_designation_on_file",
    ],
    daysAgo: 63,
  },
];

/**
 * Sample citation posts, so the board is not empty on first run. Written as
 * generic composites rather than real inspection reports.
 */
export type SeedCitation = {
  summary: string;
  narrative: string;
  correctiveAction: string;
  wacCite: string;
  severity: "NO_HARM" | "POTENTIAL_HARM" | "ACTUAL_HARM" | "IMMEDIATE_JEOPARDY";
  surveyType: "FULL_INSPECTION" | "COMPLAINT" | "FOLLOW_UP" | "CHANGE_OF_OWNERSHIP" | "OTHER";
  county: string;
  bedSizeBucket: "1-4" | "5-6" | "7-8";
  tags: string[];
  fineAmount?: number;
  daysAgo: number;
};

export const SEED_CITATIONS: SeedCitation[] = [
  {
    summary: "Negotiated care plan not updated after a resident returned from hospital",
    narrative:
      "A resident was hospitalised for four days with a fall and came back needing a walker and two-person transfers. The care plan on file still described her as independently mobile three weeks later. The surveyor pulled her file first because the hospital discharge paperwork was in the chart and the plan was not dated after it.",
    correctiveAction:
      "Updated the plan within 48 hours with the resident and her daughter, and added a standing rule that any hospital return triggers a care plan review before the resident is settled back in. We now keep a one-page trigger list on the inside cover of every resident binder.",
    wacCite: "WAC 388-76-10355",
    severity: "POTENTIAL_HARM",
    surveyType: "FULL_INSPECTION",
    county: "Pierce",
    bedSizeBucket: "5-6",
    tags: ["care plan", "change of condition", "documentation"],
    daysAgo: 12,
  },
  {
    summary: "Substitute caregiver working without a background check on file",
    narrative:
      "We used a substitute from an agency for two weekend shifts. The agency told us her check was cleared, but we had nothing in our own file. The surveyor asked to see it and we could not produce it that day.",
    correctiveAction:
      "We now refuse to schedule anyone until the cleared result is physically in our file, agency or not. Added it to the scheduling checklist so it cannot be skipped under pressure.",
    wacCite: "WAC 388-76-10160",
    severity: "ACTUAL_HARM",
    surveyType: "COMPLAINT",
    county: "King",
    bedSizeBucket: "5-6",
    tags: ["background check", "staffing", "substitutes"],
    fineAmount: 1500,
    daysAgo: 26,
  },
  {
    summary: "MAR had unsigned entries across a two-week period",
    narrative:
      "Two weeks of evening doses were unsigned on one resident's MAR. The medications had been given — the caregiver confirmed it — but there was no signature, so on paper it never happened.",
    correctiveAction:
      "Moved to a end-of-shift signature check: the outgoing caregiver signs off the MAR in front of the incoming one. Retrained both caregivers and did a full audit of the previous three months.",
    wacCite: "WAC 388-76-10430",
    severity: "POTENTIAL_HARM",
    surveyType: "FULL_INSPECTION",
    county: "Snohomish",
    bedSizeBucket: "1-4",
    tags: ["medications", "mar", "documentation"],
    daysAgo: 41,
  },
  {
    summary: "Disaster plan did not address residents who cannot use stairs",
    narrative:
      "Our plan described the routes and the assembly point but said nothing about the two residents on the upper floor who cannot manage stairs. The surveyor asked our newest caregiver what she would do and she did not have an answer.",
    correctiveAction:
      "Rewrote the plan with a named section per resident, ran a drill with the whole team, and posted a laminated copy inside the hall cupboard. The drill log is now part of the monthly routine.",
    wacCite: "WAC 388-76-10191",
    severity: "POTENTIAL_HARM",
    surveyType: "FULL_INSPECTION",
    county: "Spokane",
    bedSizeBucket: "5-6",
    tags: ["disaster plan", "evacuation", "training"],
    daysAgo: 58,
  },
  {
    summary: "TB screening for a caregiver was over a year old",
    narrative:
      "Straightforward miss. The caregiver's screening had lapsed by about seven weeks and nobody was tracking the date.",
    correctiveAction:
      "Screening rebooked the same week. We now track every expiring staff document in one place rather than in each person's folder.",
    wacCite: "WAC 388-76-10265",
    severity: "NO_HARM",
    surveyType: "FULL_INSPECTION",
    county: "Thurston",
    bedSizeBucket: "1-4",
    tags: ["tb screening", "expiry tracking", "employee records"],
    daysAgo: 74,
  },
];
