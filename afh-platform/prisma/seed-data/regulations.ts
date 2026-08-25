/**
 * Starter catalog for chapter 388-76 WAC (Adult Family Home Minimum Licensing
 * Requirements).
 *
 * HONESTY NOTE — read before relying on any of this.
 *
 * The *subchapter names and their section ranges* below come from the published
 * structure of chapter 388-76 WAC. The individual section titles are
 * descriptive labels written for this catalog, NOT quotations of the official
 * section headings, and no section text has been reproduced or checked here.
 *
 * Every entry is therefore seeded with `verified: false`, which surfaces an
 * "unverified" badge everywhere the citation appears in the UI. Before this
 * platform is used to prepare for a real survey, each entry must be checked
 * against the official text at:
 *
 *   https://app.leg.wa.gov/wac/default.aspx?cite=388-76
 *
 * and then either corrected in place or replaced wholesale via:
 *
 *   npm run wac:import -- path/to/verified-wac.json
 *
 * which sets `verified: true` on what it loads.
 */

export type SeedRegulation = {
  cite: string;
  title: string;
  subchapter: string;
  summary: string;
};

const WAC_URL = "https://app.leg.wa.gov/wac/default.aspx?cite=";

export function regulationUrl(cite: string): string {
  return `${WAC_URL}${cite.replace(/^WAC\s+/, "")}`;
}

export const SEED_REGULATIONS: SeedRegulation[] = [
  {
    cite: "WAC 388-76-10000",
    subchapter: "Definitions",
    title: "Definitions used throughout the chapter",
    summary:
      "Opening section of the definitions subchapter (388-76-10000 through 10004).",
  },
  {
    cite: "WAC 388-76-10005",
    subchapter: "License",
    title: "License required to operate an adult family home",
    summary:
      "Opening section of the license subchapter (388-76-10005 through 10050), covering who must be licensed and what the license permits.",
  },
  {
    cite: "WAC 388-76-10031",
    subchapter: "License",
    title: "License requirements — seven or eight bed adult family homes",
    summary:
      "Additional requirements that apply only to homes licensed for seven or eight beds.",
  },
  {
    cite: "WAC 388-76-10055",
    subchapter: "License application",
    title: "License application requirements",
    summary:
      "Opening section of the license application subchapter (388-76-10055 through 10110).",
  },
  {
    cite: "WAC 388-76-10115",
    subchapter: "Granting or denying a license",
    title: "Grounds for granting or denying a license",
    summary: "Opening section of the granting/denying subchapter (388-76-10115 through 10125).",
  },
  {
    cite: "WAC 388-76-10129",
    subchapter: "Qualifications of individuals providing care and services",
    title: "Qualifications — adult family home personnel",
    summary:
      "Qualification requirements for the people who provide care and services in the home. Opens the qualifications subchapter (388-76-10129 through 10150).",
  },
  {
    cite: "WAC 388-76-10160",
    subchapter: "Criminal history background check",
    title: "Criminal history background check requirements",
    summary:
      "Opening section of the background check subchapter (388-76-10160 through 10181), covering who must be checked and when.",
  },
  {
    cite: "WAC 388-76-10191",
    subchapter: "Administration general",
    title: "General administration of the home",
    summary:
      "Opening section of the general administration subchapter (388-76-10191 through 10230), covering policies, records, reporting, and disaster preparedness.",
  },
  {
    cite: "WAC 388-76-10235",
    subchapter: "Health care decision making",
    title: "Health care decision making",
    summary:
      "Opening section of the health care decision making subchapter (388-76-10235 through 10250).",
  },
  {
    cite: "WAC 388-76-10255",
    subchapter: "Infection control and communicable disease",
    title: "Infection control and communicable disease",
    summary:
      "Opening section of the infection control subchapter (388-76-10255 through 10260).",
  },
  {
    cite: "WAC 388-76-10265",
    subchapter: "Tuberculosis screening",
    title: "Tuberculosis screening",
    summary:
      "Opening section of the tuberculosis screening subchapter (388-76-10265 through 10310), covering screening of staff and residents.",
  },
  {
    cite: "WAC 388-76-10315",
    subchapter: "Resident records",
    title: "Resident records the home must keep",
    summary:
      "Opening section of the resident records subchapter (388-76-10315 through 10325).",
  },
  {
    cite: "WAC 388-76-10330",
    subchapter: "Resident assessment",
    title: "Resident assessment requirements",
    summary:
      "Opening section of the resident assessment subchapter (388-76-10330 through 10351), covering initial and ongoing assessment.",
  },
  {
    cite: "WAC 388-76-10355",
    subchapter: "Negotiated care plan",
    title: "Negotiated care plan requirements",
    summary:
      "Opening section of the negotiated care plan subchapter (388-76-10355 through 10385), covering content, participants, and review.",
  },
  {
    cite: "WAC 388-76-10390",
    subchapter: "Care and services",
    title: "Care and services the home must provide",
    summary: "Opening section of the care and services subchapter (388-76-10390 through 10410).",
  },
  {
    cite: "WAC 388-76-10415",
    subchapter: "Food services",
    title: "Food services",
    summary: "Opening section of the food services subchapter (388-76-10415 through 10425).",
  },
  {
    cite: "WAC 388-76-10430",
    subchapter: "Resident medications",
    title: "Resident medication requirements",
    summary:
      "Opening section of the resident medications subchapter (388-76-10430 through 10490), covering storage, administration, records, and self-administration.",
  },
  {
    cite: "WAC 388-76-10495",
    subchapter: "Specialty care",
    title: "Specialty care designations",
    summary:
      "Opening section of the specialty care subchapter (388-76-10495 through 10505), covering dementia, mental health, and developmental disability designations.",
  },
  {
    cite: "WAC 388-76-10510",
    subchapter: "Resident rights",
    title: "Resident rights",
    summary: "Opening section of the resident rights subchapter (388-76-10510 onward).",
  },
];
