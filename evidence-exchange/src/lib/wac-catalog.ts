/**
 * A starter catalog of requirement topics an adult family home inspection
 * commonly turns on, used to speed up drafting a finding.
 *
 * IMPORTANT: every entry is marked `verified: false`. The citation numbers and
 * requirement summaries below are drafting conveniences typed from general
 * familiarity with the chapter — they are NOT an authoritative copy of the
 * rule text, and the UI says so wherever the catalog appears. Before a real
 * deployment the agency loads its own rule table (an export from the code
 * reviser, or a CSV from the program's policy unit) and flips `verified`.
 *
 * A finding's citation field is always free text, so an inspector is never
 * limited to, or misled by, this list.
 */

export type RequirementTopic = {
  cite: string;
  topic: string;
  /** Paraphrase, not rule text. */
  summary: string;
  category: string;
  verified: boolean;
};

export const REQUIREMENT_TOPICS: RequirementTopic[] = [
  {
    cite: "WAC 388-76-10130",
    topic: "Provider qualifications",
    summary: "The provider must meet the qualification and training requirements for licensure.",
    category: "Licensing and administration",
    verified: false,
  },
  {
    cite: "WAC 388-76-10160",
    topic: "Background checks",
    summary:
      "Background checks must be completed before an individual has unsupervised access to residents.",
    category: "Staffing",
    verified: false,
  },
  {
    cite: "WAC 388-76-10175",
    topic: "Staff orientation and training",
    summary:
      "Staff must complete orientation, basic training, and continuing education within required timeframes.",
    category: "Staffing",
    verified: false,
  },
  {
    cite: "WAC 388-76-10345",
    topic: "Resident rights",
    summary: "The home must protect and promote the rights of each resident.",
    category: "Resident rights",
    verified: false,
  },
  {
    cite: "WAC 388-76-10375",
    topic: "Negotiated care plan",
    summary:
      "A negotiated care plan must be developed with the resident and kept current as needs change.",
    category: "Resident care",
    verified: false,
  },
  {
    cite: "WAC 388-76-10395",
    topic: "Medication assistance and administration",
    summary:
      "Medications must be assisted with or administered only as permitted, and accurately documented.",
    category: "Medications",
    verified: false,
  },
  {
    cite: "WAC 388-76-10405",
    topic: "Nurse delegation",
    summary: "Delegated nursing tasks must be performed only under a current delegation.",
    category: "Medications",
    verified: false,
  },
  {
    cite: "WAC 388-76-10420",
    topic: "Resident assessment",
    summary:
      "Each resident must be assessed on admission and reassessed on a change of condition.",
    category: "Resident care",
    verified: false,
  },
  {
    cite: "WAC 388-76-10425",
    topic: "CPR and first aid",
    summary:
      "Staff with direct resident contact must hold current CPR and first-aid certification.",
    category: "Staffing",
    verified: false,
  },
  {
    cite: "WAC 388-76-10490",
    topic: "Food and nutrition",
    summary: "The home must provide nutritious meals meeting each resident's dietary needs.",
    category: "Environment and services",
    verified: false,
  },
  {
    cite: "WAC 388-76-10515",
    topic: "Emergency and disaster preparedness",
    summary:
      "The home must maintain a current disaster plan and practice evacuation drills.",
    category: "Safety",
    verified: false,
  },
  {
    cite: "WAC 388-76-10740",
    topic: "Fire safety equipment",
    summary:
      "Smoke detectors and fire extinguishers must be present, current, and in working order.",
    category: "Safety",
    verified: false,
  },
  {
    cite: "WAC 388-76-10790",
    topic: "Home maintenance and environment",
    summary: "The home must be maintained in a safe, clean, and functional condition.",
    category: "Environment and services",
    verified: false,
  },
  {
    cite: "WAC 388-76-10940",
    topic: "Mandated reporting",
    summary:
      "Suspected abandonment, abuse, neglect, or financial exploitation must be reported as required.",
    category: "Resident rights",
    verified: false,
  },
];

export const REQUIREMENT_CATEGORIES = Array.from(
  new Set(REQUIREMENT_TOPICS.map((t) => t.category)),
).sort();

export function findTopic(cite: string): RequirementTopic | undefined {
  return REQUIREMENT_TOPICS.find((t) => t.cite === cite);
}
