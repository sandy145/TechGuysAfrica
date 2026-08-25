/**
 * Starter form templates.
 *
 * A template is a set of field definitions plus a body with {{token}}
 * placeholders. Tokens resolve from the form's own fields first, then from a
 * context set every template can use: home_name, home_license, home_address,
 * home_phone, resident_name, employee_name, today.
 *
 * These are working drafts modelled on what adult family homes commonly keep,
 * not official state forms. Where the department publishes an official form,
 * use the official one — upload it to the vault instead. Review and adapt every
 * template below before putting it in front of a resident or their family.
 */

import type { FieldDef, SignerDef } from "../../src/lib/forms/types";

export type SeedFormTemplate = {
  code: string;
  title: string;
  description: string;
  category: string;
  wacCite: string | null;
  subjectType: "HOME" | "RESIDENT" | "EMPLOYEE";
  documentTypeCode: string | null;
  fields: FieldDef[];
  signers: SignerDef[];
  body: string;
};

export const SEED_FORM_TEMPLATES: SeedFormTemplate[] = [
  {
    code: "negotiated_care_plan",
    title: "Negotiated care plan",
    description:
      "The plan negotiated with the resident and their representative: what they need, how the home will meet it, and what they prefer.",
    category: "Resident care",
    wacCite: "WAC 388-76-10355",
    subjectType: "RESIDENT",
    documentTypeCode: "negotiated_care_plan",
    fields: [
      { key: "plan_type", label: "Plan type", type: "radio", options: ["Initial", "Annual review", "Change in condition"], required: true, width: "half" },
      { key: "review_date", label: "Next review due", type: "date", required: true, width: "half" },
      { key: "participants", label: "Who took part in negotiating this plan", type: "textarea", required: true, help: "Resident, representative, provider, and anyone else present." },
      { key: "h_needs", label: "Assessed needs", type: "heading" },
      { key: "mobility", label: "Mobility and transfers", type: "textarea", required: true },
      { key: "adls", label: "Personal care and daily living", type: "textarea", required: true, help: "Bathing, dressing, toileting, grooming, eating." },
      { key: "medications", label: "Medication support", type: "textarea", required: true },
      { key: "health_conditions", label: "Health conditions and treatments", type: "textarea" },
      { key: "cognition", label: "Cognition, memory, and behaviour", type: "textarea" },
      { key: "nutrition", label: "Diet and nutrition", type: "textarea" },
      { key: "h_prefs", label: "Preferences and routines", type: "heading" },
      { key: "daily_routine", label: "Preferred daily routine", type: "textarea" },
      { key: "activities", label: "Activities and social contact", type: "textarea" },
      { key: "cultural", label: "Cultural, religious, and language needs", type: "textarea" },
      { key: "h_risk", label: "Risk and emergencies", type: "heading" },
      { key: "risks", label: "Identified risks and how they are managed", type: "textarea", required: true, help: "Falls, wandering, choking, self-neglect, and the specific steps staff take." },
      { key: "emergency_contact", label: "Emergency contact", type: "text", width: "half" },
      { key: "practitioner", label: "Primary care practitioner", type: "text", width: "half" },
      { key: "negotiated_choices", label: "Choices the resident has made against advice", type: "textarea", help: "Record informed choices and the discussion about the risks." },
    ],
    signers: [
      { key: "provider", label: "Provider or resident manager", required: true },
      { key: "resident", label: "Resident", required: false, remote: true },
      { key: "representative", label: "Resident representative", required: false, remote: true },
    ],
    body: `**Resident:** {{resident_name}}
**Home:** {{home_name}} · License {{home_license}}
**Plan type:** {{plan_type}}
**Prepared:** {{today}} · **Next review due:** {{review_date}}

### Who took part
{{participants}}

## Assessed needs

### Mobility and transfers
{{mobility}}

### Personal care and daily living
{{adls}}

### Medication support
{{medications}}

### Health conditions and treatments
{{health_conditions}}

### Cognition, memory, and behaviour
{{cognition}}

### Diet and nutrition
{{nutrition}}

## Preferences and routines

### Preferred daily routine
{{daily_routine}}

### Activities and social contact
{{activities}}

### Cultural, religious, and language needs
{{cultural}}

## Risk management
{{risks}}

**Emergency contact:** {{emergency_contact}}
**Primary care practitioner:** {{practitioner}}

### Informed choices made against advice
{{negotiated_choices}}

---

This plan was negotiated with the resident and, where applicable, their representative. It is reviewed at least annually and whenever there is a significant change in the resident's condition.`,
  },

  {
    code: "resident_rights_ack",
    title: "Resident rights acknowledgement",
    description:
      "Record that resident rights were provided, explained, and understood.",
    category: "Resident care",
    wacCite: "WAC 388-76-10510",
    subjectType: "RESIDENT",
    documentTypeCode: "resident_rights_ack",
    fields: [
      { key: "provided_date", label: "Date rights were provided", type: "date", required: true, width: "half" },
      { key: "format", label: "Format provided in", type: "select", options: ["Printed copy", "Large print", "Read aloud", "Translated copy"], width: "half" },
      { key: "language", label: "Language", type: "text", width: "half" },
      { key: "explained_by", label: "Explained by", type: "text", required: true, width: "half" },
      { key: "topics", label: "Topics covered", type: "checklist", options: ["Dignity and respect", "Privacy", "Freedom from abuse, neglect, and exploitation", "Freedom from restraints", "Control of personal funds", "Participation in care planning", "Refusing treatment", "Visitors and communication", "Complaints and grievances", "The long-term care ombuds", "Notice before transfer or discharge"], required: true },
      { key: "questions", label: "Questions raised and how they were answered", type: "textarea" },
    ],
    signers: [
      { key: "provider", label: "Provider or resident manager", required: true },
      { key: "resident", label: "Resident", required: false, remote: true },
      { key: "representative", label: "Resident representative", required: false, remote: true },
    ],
    body: `**Resident:** {{resident_name}}
**Home:** {{home_name}} · {{home_address}} · {{home_phone}}

I confirm that on **{{provided_date}}** I was given a copy of my rights as a resident of an adult family home, and that they were explained to me by **{{explained_by}}**.

**Format:** {{format}} · **Language:** {{language}}

### Rights covered in this discussion
{{topics}}

### Questions raised
{{questions}}

---

I understand that I can raise a concern with the provider at any time without fear of retaliation, and that I may contact the Washington State Long-Term Care Ombuds independently of the home.`,
  },

  {
    code: "admission_agreement",
    title: "Admission agreement and disclosure of services",
    description:
      "What the home provides, what it does not, what it costs, and the terms of residency.",
    category: "Resident care",
    wacCite: "WAC 388-76-10315",
    subjectType: "RESIDENT",
    documentTypeCode: "admission_agreement",
    fields: [
      { key: "admission_date", label: "Admission date", type: "date", required: true, width: "half" },
      { key: "room", label: "Room", type: "text", width: "half" },
      { key: "base_rate", label: "Base monthly rate", type: "text", required: true, width: "half" },
      { key: "payment_source", label: "Payment source", type: "select", options: ["Private pay", "Medicaid", "Long-term care insurance", "Combination"], required: true, width: "half" },
      { key: "included", label: "Services included in the base rate", type: "checklist", options: ["Room and utilities", "Three meals and snacks", "Laundry", "Housekeeping", "Personal care assistance", "Medication assistance", "Transportation to appointments", "Activities"], required: true },
      { key: "extra_charges", label: "Services available at extra cost", type: "textarea", help: "List each service and its charge." },
      { key: "not_provided", label: "Services the home does NOT provide", type: "textarea", required: true, help: "Be specific. This is what protects both of you later." },
      { key: "rate_change", label: "How and when rates change", type: "textarea", required: true },
      { key: "refund_policy", label: "Refund policy", type: "textarea", required: true },
      { key: "discharge_terms", label: "Circumstances that could lead to transfer or discharge", type: "textarea", required: true },
      { key: "notice_period", label: "Notice period", type: "text", width: "half" },
    ],
    signers: [
      { key: "provider", label: "Provider", required: true },
      { key: "resident", label: "Resident", required: false, remote: true },
      { key: "representative", label: "Resident representative", required: false, remote: true },
    ],
    body: `**Home:** {{home_name}} · License {{home_license}}
**Address:** {{home_address}} · **Phone:** {{home_phone}}
**Resident:** {{resident_name}}
**Admission date:** {{admission_date}} · **Room:** {{room}}

## Rates and payment

**Base monthly rate:** {{base_rate}}
**Payment source:** {{payment_source}}

### Included in the base rate
{{included}}

### Available at additional cost
{{extra_charges}}

### How rates change
{{rate_change}}

## Services this home does not provide
{{not_provided}}

## Ending the agreement

### Refunds
{{refund_policy}}

### Transfer and discharge
{{discharge_terms}}

**Notice period:** {{notice_period}}

---

Signing below confirms that these terms were explained, that the resident or their representative had the opportunity to ask questions, and that a copy of this agreement was provided.`,
  },

  {
    code: "med_self_admin_assessment",
    title: "Medication self-administration assessment",
    description:
      "Assessment supporting a resident's decision to manage their own medications.",
    category: "Resident care",
    wacCite: "WAC 388-76-10430",
    subjectType: "RESIDENT",
    documentTypeCode: "med_self_admin_assessment",
    fields: [
      { key: "assessment_date", label: "Assessment date", type: "date", required: true, width: "half" },
      { key: "assessed_by", label: "Assessed by", type: "text", required: true, width: "half" },
      { key: "medications", label: "Medications the resident will self-administer", type: "textarea", required: true },
      { key: "capabilities", label: "Demonstrated abilities", type: "checklist", options: ["Identifies each medication correctly", "Knows the correct dose", "Knows the correct time", "Knows what each medication is for", "Knows common side effects", "Can open containers", "Can measure liquid doses", "Stores medication securely", "Asks for help when unsure"], required: true },
      { key: "storage", label: "How and where medications are stored", type: "textarea", required: true },
      { key: "risks", label: "Identified risks and safeguards", type: "textarea", required: true },
      { key: "monitoring", label: "How the home will monitor", type: "textarea", required: true },
      { key: "outcome", label: "Assessment outcome", type: "radio", options: ["Approved for full self-administration", "Approved with assistance", "Not approved"], required: true },
    ],
    signers: [
      { key: "provider", label: "Provider or resident manager", required: true },
      { key: "resident", label: "Resident", required: false, remote: true },
    ],
    body: `**Resident:** {{resident_name}}
**Home:** {{home_name}}
**Assessment date:** {{assessment_date}} · **Assessed by:** {{assessed_by}}

### Medications covered
{{medications}}

### Demonstrated abilities
{{capabilities}}

### Storage
{{storage}}

### Risks and safeguards
{{risks}}

### Monitoring
{{monitoring}}

---

**Outcome: {{outcome}}**

This assessment is reviewed at least annually and whenever the resident's condition or medication regimen changes.`,
  },

  {
    code: "employee_orientation",
    title: "Employee orientation checklist",
    description:
      "Record that a new caregiver was oriented before they started providing care.",
    category: "Staff",
    wacCite: "WAC 388-76-10129",
    subjectType: "EMPLOYEE",
    documentTypeCode: "orientation_record",
    fields: [
      { key: "orientation_date", label: "Orientation date", type: "date", required: true, width: "half" },
      { key: "conducted_by", label: "Conducted by", type: "text", required: true, width: "half" },
      { key: "topics", label: "Topics covered", type: "checklist", options: ["Resident rights", "Mandatory abuse and neglect reporting", "Confidentiality and privacy", "Fire safety and evacuation routes", "Disaster plan and resident-specific evacuation needs", "Infection control and hand hygiene", "Bloodborne pathogens", "Emergency contacts and when to call 911", "Incident reporting", "Each resident's negotiated care plan", "Medication policies", "Body mechanics and safe transfers", "Job description and expectations"], required: true },
      { key: "residents_reviewed", label: "Residents whose care plans were reviewed", type: "textarea", required: true },
      { key: "supervised_until", label: "Supervised until", type: "date", width: "half", help: "Date after which this person may work unsupervised." },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    signers: [
      { key: "employee", label: "Employee", required: true },
      { key: "provider", label: "Provider or resident manager", required: true },
    ],
    body: `**Employee:** {{employee_name}}
**Home:** {{home_name}} · License {{home_license}}
**Orientation date:** {{orientation_date}} · **Conducted by:** {{conducted_by}}

### Topics covered
{{topics}}

### Resident care plans reviewed
{{residents_reviewed}}

**Supervised until:** {{supervised_until}}

### Notes
{{notes}}

---

By signing, the employee confirms they received this orientation, understood it, and had the opportunity to ask questions. The provider confirms the orientation was completed before the employee provided unsupervised care.`,
  },

  {
    code: "job_description_ack",
    title: "Job description and acknowledgement",
    description: "The role, its duties, and the employee's acknowledgement of them.",
    category: "Staff",
    wacCite: "WAC 388-76-10191",
    subjectType: "EMPLOYEE",
    documentTypeCode: "job_description_signed",
    fields: [
      { key: "position", label: "Position title", type: "text", required: true, width: "half" },
      { key: "start_date", label: "Start date", type: "date", required: true, width: "half" },
      { key: "reports_to", label: "Reports to", type: "text", width: "half" },
      { key: "schedule", label: "Usual schedule", type: "text", width: "half" },
      { key: "duties", label: "Duties and responsibilities", type: "textarea", required: true },
      { key: "requirements", label: "Credentials and training required for this role", type: "textarea", required: true },
      { key: "physical", label: "Physical requirements", type: "textarea" },
      { key: "mandatory_reporting", label: "Mandatory reporting acknowledgement", type: "checkbox", placeholder: "I understand I am a mandated reporter of suspected abuse, neglect, abandonment, and financial exploitation.", required: true },
    ],
    signers: [
      { key: "employee", label: "Employee", required: true },
      { key: "provider", label: "Provider", required: true },
    ],
    body: `**Employee:** {{employee_name}}
**Home:** {{home_name}}
**Position:** {{position}} · **Start date:** {{start_date}}
**Reports to:** {{reports_to}} · **Usual schedule:** {{schedule}}

### Duties and responsibilities
{{duties}}

### Credentials and training required
{{requirements}}

### Physical requirements
{{physical}}

### Mandated reporting
Mandated reporter acknowledgement: **{{mandatory_reporting}}**

I understand that I am required to report suspected abuse, neglect, abandonment, or financial exploitation of a vulnerable adult, and that this obligation is personal to me and is not discharged by telling a supervisor alone.

---

I have read this job description, I understand what is expected of me, and I have received a copy.`,
  },

  {
    code: "disaster_plan",
    title: "Disaster and emergency preparedness plan",
    description:
      "Evacuation, sheltering, utility loss, and each resident's specific needs in an emergency.",
    category: "Home operations",
    wacCite: "WAC 388-76-10191",
    subjectType: "HOME",
    documentTypeCode: "disaster_plan",
    fields: [
      { key: "reviewed_date", label: "Date reviewed", type: "date", required: true, width: "half" },
      { key: "reviewed_by", label: "Reviewed by", type: "text", required: true, width: "half" },
      { key: "h_evac", label: "Evacuation", type: "heading" },
      { key: "primary_exit", label: "Primary evacuation route", type: "textarea", required: true },
      { key: "secondary_exit", label: "Secondary evacuation route", type: "textarea", required: true },
      { key: "meeting_point", label: "Assembly point", type: "text", required: true },
      { key: "relocation_site", label: "Relocation site if the home is unusable", type: "textarea", required: true, help: "Name, address, and phone of where residents go." },
      { key: "transport", label: "How residents get there", type: "textarea", required: true },
      { key: "resident_needs", label: "Resident-specific evacuation needs", type: "textarea", required: true, help: "Who needs a wheelchair, who cannot manage stairs, who needs oxygen, who may resist leaving." },
      { key: "h_utilities", label: "Loss of utilities", type: "heading" },
      { key: "power_loss", label: "Power failure plan", type: "textarea", required: true },
      { key: "water_loss", label: "Water failure plan", type: "textarea", required: true },
      { key: "heat_loss", label: "Heat failure plan", type: "textarea", required: true },
      { key: "h_supplies", label: "Supplies and contacts", type: "heading" },
      { key: "supplies", label: "Emergency supplies held and where", type: "textarea", required: true, help: "Water, non-perishable food, medications, flashlights, batteries, first aid, blankets." },
      { key: "supply_days", label: "Days of supplies on hand", type: "number", width: "half" },
      { key: "emergency_contacts", label: "Emergency contact list", type: "textarea", required: true },
      { key: "notification", label: "How families and the department are notified", type: "textarea", required: true },
      { key: "drills", label: "Drill schedule", type: "textarea", required: true },
    ],
    signers: [{ key: "provider", label: "Provider", required: true }],
    body: `**Home:** {{home_name}} · License {{home_license}}
**Address:** {{home_address}} · **Phone:** {{home_phone}}
**Reviewed:** {{reviewed_date}} by {{reviewed_by}}

## Evacuation

### Primary route
{{primary_exit}}

### Secondary route
{{secondary_exit}}

**Assembly point:** {{meeting_point}}

### Relocation site
{{relocation_site}}

### Transport
{{transport}}

### Resident-specific needs
{{resident_needs}}

## Loss of utilities

### Power
{{power_loss}}

### Water
{{water_loss}}

### Heat
{{heat_loss}}

## Supplies

{{supplies}}

**Days of supplies on hand:** {{supply_days}}

## Contacts and notification

{{emergency_contacts}}

### Notification procedure
{{notification}}

## Drills
{{drills}}

---

This plan is reviewed at least annually and after any incident that tests it.`,
  },
];
