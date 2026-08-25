/**
 * The automatic checks the compliance engine runs.
 *
 * Each one ties a document type to a regulation and says when it applies. The
 * applicability predicates are the interesting part: a home with no staff is
 * never asked for employee files, and a home without a dementia designation is
 * never asked for dementia specialty training.
 *
 * Like the rest of the seed, these encode common expectations rather than
 * verified rule text — the linked regulation is marked unverified until it has
 * been checked. Edit, disable, or add checks to match what your licensor
 * actually asks for.
 */

export type SeedRuleCheck = {
  code: string;
  regulationCite: string | null;
  title: string;
  description?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  checkType: "HOME_DOCUMENT" | "PER_RESIDENT_DOCUMENT" | "PER_EMPLOYEE_DOCUMENT" | "PROFILE_FLAG";
  documentTypeCode?: string;
  appliesWhen?: Record<string, unknown>;
  subjectWhen?: Record<string, unknown>;
  params?: Record<string, unknown>;
  remediation: string;
};

/** Staff who actually touch residents; volunteers and contractors differ. */
const CARE_STAFF = ["PROVIDER", "ENTITY_REPRESENTATIVE", "RESIDENT_MANAGER", "CAREGIVER", "SUBSTITUTE"];

export const SEED_RULE_CHECKS: SeedRuleCheck[] = [
  // ---- Home profile ----
  {
    code: "home_license_number_recorded",
    regulationCite: "WAC 388-76-10005",
    title: "License number recorded on the home profile",
    severity: "LOW",
    checkType: "PROFILE_FLAG",
    params: { field: "licenseNumber", mustBePresent: true },
    remediation: "Add your license number under Settings → Home profile.",
  },

  // ---- Home documents ----
  {
    code: "home_license_on_file",
    regulationCite: "WAC 388-76-10005",
    title: "Current adult family home license on file",
    severity: "CRITICAL",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "afh_license",
    remediation: "Upload your current license certificate to the vault under Licensing.",
  },
  {
    code: "business_license_on_file",
    regulationCite: "WAC 388-76-10055",
    title: "Washington business license on file",
    severity: "MEDIUM",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "business_license",
    remediation: "Upload the current state business license for the operating entity.",
  },
  {
    code: "liability_insurance_current",
    regulationCite: "WAC 388-76-10191",
    title: "Liability insurance certificate current",
    severity: "HIGH",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "liability_insurance",
    remediation: "Upload the current certificate of insurance and record its expiry date.",
  },
  {
    code: "disaster_plan_current",
    regulationCite: "WAC 388-76-10191",
    title: "Disaster and emergency preparedness plan reviewed in the last year",
    severity: "HIGH",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "disaster_plan",
    remediation:
      "Generate the disaster plan under Forms, or upload your existing plan with the date it was last reviewed.",
  },
  {
    code: "evacuation_drills_logged",
    regulationCite: "WAC 388-76-10191",
    title: "Evacuation drills logged",
    severity: "MEDIUM",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "evacuation_drill_log",
    remediation: "Upload your drill log showing recent practice evacuations and who took part.",
  },
  {
    code: "fire_inspection_current",
    regulationCite: "WAC 388-76-10191",
    title: "Fire safety inspection or alarm service current",
    severity: "HIGH",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "fire_safety_inspection",
    remediation: "Upload the most recent fire inspection or alarm/extinguisher service record.",
  },
  {
    code: "policies_on_file",
    regulationCite: "WAC 388-76-10191",
    title: "Written policies and procedures on file",
    severity: "MEDIUM",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "policies_procedures",
    remediation: "Upload your policy manual, including abuse reporting and grievance procedures.",
  },
  {
    code: "infection_control_plan_current",
    regulationCite: "WAC 388-76-10255",
    title: "Infection control plan current",
    severity: "MEDIUM",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "infection_control_plan",
    remediation: "Upload your written infection prevention and communicable disease procedures.",
  },
  {
    code: "staffing_schedule_current",
    regulationCite: "WAC 388-76-10191",
    title: "Current staffing schedule posted",
    severity: "MEDIUM",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "staffing_schedule",
    appliesWhen: { employsStaff: true },
    remediation: "Upload the current schedule showing who covers each shift.",
  },
  {
    code: "medicaid_contract_current",
    regulationCite: "WAC 388-76-10191",
    title: "Medicaid contract current",
    severity: "HIGH",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "medicaid_contract",
    appliesWhen: { servesMedicaid: true },
    remediation: "Upload your current Medicaid contract and rate letter.",
  },
  {
    code: "specialty_designation_on_file",
    regulationCite: "WAC 388-76-10495",
    title: "Specialty designation approval on file",
    severity: "HIGH",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "specialty_designation",
    appliesWhen: {
      specialtiesIncludeAny: ["DEMENTIA", "MENTAL_HEALTH", "DEVELOPMENTAL_DISABILITIES"],
    },
    remediation:
      "Upload the departmental approval for each specialty designation your home holds.",
  },
  {
    code: "seven_eight_bed_docs",
    regulationCite: "WAC 388-76-10031",
    title: "Seven or eight bed licensing documentation on file",
    severity: "HIGH",
    checkType: "HOME_DOCUMENT",
    documentTypeCode: "seven_eight_bed_approval",
    appliesWhen: { bedCapacityMin: 7 },
    remediation:
      "Homes licensed for seven or eight beds carry extra conditions. Upload the approval and any conditions attached to it.",
  },

  // ---- Per resident ----
  {
    code: "resident_admission_agreement",
    regulationCite: "WAC 388-76-10315",
    title: "Signed admission agreement",
    severity: "HIGH",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "admission_agreement",
    remediation: "Generate the admission agreement under Forms and have it signed, or upload the signed copy.",
  },
  {
    code: "resident_disclosure_of_services",
    regulationCite: "WAC 388-76-10315",
    title: "Disclosure of services provided",
    severity: "MEDIUM",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "disclosure_of_services",
    remediation: "File the written disclosure of what the home does and does not provide.",
  },
  {
    code: "resident_rights_acknowledged",
    regulationCite: "WAC 388-76-10510",
    title: "Resident rights acknowledgement signed",
    severity: "HIGH",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "resident_rights_ack",
    remediation:
      "Generate the resident rights acknowledgement under Forms and have the resident or their representative sign it.",
  },
  {
    code: "resident_assessment_current",
    regulationCite: "WAC 388-76-10330",
    title: "Resident assessment current",
    severity: "CRITICAL",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "resident_assessment",
    params: { withinDaysOfAdmission: 30 },
    remediation:
      "Complete an assessment within 30 days of admission and review it at least annually.",
  },
  {
    code: "negotiated_care_plan_current",
    regulationCite: "WAC 388-76-10355",
    title: "Negotiated care plan current",
    severity: "CRITICAL",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "negotiated_care_plan",
    params: { withinDaysOfAdmission: 30 },
    remediation:
      "Generate the negotiated care plan under Forms, have the resident or representative sign it, and review it at least annually and after any significant change.",
  },
  {
    code: "resident_physician_orders",
    regulationCite: "WAC 388-76-10430",
    title: "Current practitioner orders on file",
    severity: "HIGH",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "physician_orders",
    remediation: "Upload current orders covering medications, treatments, and diet.",
  },
  {
    code: "resident_medication_record",
    regulationCite: "WAC 388-76-10430",
    title: "Medication administration record current",
    severity: "CRITICAL",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "medication_record",
    subjectWhen: { selfAdministersMedication: false },
    remediation: "File the current MAR for this resident.",
  },
  {
    code: "resident_self_admin_assessment",
    regulationCite: "WAC 388-76-10430",
    title: "Self-administration assessment on file",
    severity: "HIGH",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "med_self_admin_assessment",
    subjectWhen: { selfAdministersMedication: true },
    remediation:
      "A resident who self-administers needs a current assessment supporting that decision.",
  },
  {
    code: "resident_nurse_delegation",
    regulationCite: "WAC 388-76-10430",
    title: "Nurse delegation consent and supervisory visits current",
    severity: "HIGH",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "nurse_delegation_consent",
    appliesWhen: { usesNurseDelegation: true },
    remediation:
      "File the delegation consent, the RN's written instructions, and the record of supervisory visits.",
  },
  {
    code: "resident_health_care_directive",
    regulationCite: "WAC 388-76-10235",
    title: "Advance directive status documented",
    severity: "MEDIUM",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "health_care_directive",
    remediation:
      "File the resident's advance directive or POLST, or documentation that they were offered one and declined.",
  },
  {
    code: "resident_tb_screening",
    regulationCite: "WAC 388-76-10265",
    title: "Resident tuberculosis screening on file",
    severity: "HIGH",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "resident_tb_screening",
    params: { withinDaysOfAdmission: 30 },
    remediation: "File the TB screening result completed around the time of admission.",
  },
  {
    code: "resident_dementia_addendum",
    regulationCite: "WAC 388-76-10495",
    title: "Dementia care planning documented",
    severity: "HIGH",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "dementia_care_plan_addendum",
    appliesWhen: { specialtiesIncludeAny: ["DEMENTIA"] },
    subjectWhen: { hasDementiaDiagnosis: true },
    remediation:
      "Residents with a dementia diagnosis in a dementia-designated home need the additional care planning on file.",
  },
  {
    code: "resident_funds_accounted",
    regulationCite: "WAC 388-76-10510",
    title: "Resident funds accounting current",
    severity: "MEDIUM",
    checkType: "PER_RESIDENT_DOCUMENT",
    documentTypeCode: "resident_funds_record",
    subjectWhen: { isMedicaid: true },
    remediation:
      "Keep a current accounting of any resident money the home holds. Delete this check if you hold none.",
  },

  // ---- Per employee ----
  {
    code: "employee_background_check",
    regulationCite: "WAC 388-76-10160",
    title: "Criminal history background check cleared",
    severity: "CRITICAL",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "background_check",
    appliesWhen: { employsStaff: true },
    remediation:
      "No one may have unsupervised access to residents without a cleared background check on file.",
  },
  {
    code: "employee_tb_screening",
    regulationCite: "WAC 388-76-10265",
    title: "Staff tuberculosis screening current",
    severity: "HIGH",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "employee_tb_screening",
    appliesWhen: { employsStaff: true },
    subjectWhen: { hasDirectResidentContact: true },
    params: { withinDaysOfHire: 30 },
    remediation: "File the TB screening result and record its date.",
  },
  {
    code: "employee_credential",
    regulationCite: "WAC 388-76-10129",
    title: "Home care aide or nursing assistant credential current",
    severity: "CRITICAL",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "hca_credential",
    appliesWhen: { employsStaff: true },
    subjectWhen: { roleIn: CARE_STAFF, hasDirectResidentContact: true },
    remediation:
      "Upload the current Department of Health credential and record its expiry date.",
  },
  {
    code: "employee_cpr_first_aid",
    regulationCite: "WAC 388-76-10129",
    title: "CPR and first aid certification current",
    severity: "HIGH",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "cpr_first_aid",
    appliesWhen: { employsStaff: true },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation: "Upload current CPR and first aid cards.",
  },
  {
    code: "employee_hiv_training",
    regulationCite: "WAC 388-76-10129",
    title: "HIV/AIDS training completed",
    severity: "MEDIUM",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "hiv_aids_training",
    appliesWhen: { employsStaff: true },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation: "File the training certificate.",
  },
  {
    code: "employee_orientation",
    regulationCite: "WAC 388-76-10129",
    title: "Orientation and safety training documented",
    severity: "HIGH",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "orientation_record",
    appliesWhen: { employsStaff: true },
    params: { withinDaysOfHire: 14 },
    remediation:
      "Generate the orientation checklist under Forms and have the employee sign it before they start work.",
  },
  {
    code: "employee_continuing_education",
    regulationCite: "WAC 388-76-10129",
    title: "Annual continuing education current",
    severity: "MEDIUM",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "continuing_education",
    appliesWhen: { employsStaff: true },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation: "Record this year's continuing education hours.",
  },
  {
    code: "employee_food_worker_card",
    regulationCite: "WAC 388-76-10415",
    title: "Food worker card current",
    severity: "MEDIUM",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "food_worker_card",
    appliesWhen: { employsStaff: true },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation: "Anyone preparing or handling food needs a current food worker card.",
  },
  {
    code: "employee_job_description",
    regulationCite: "WAC 388-76-10191",
    title: "Signed job description on file",
    severity: "LOW",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "job_description_signed",
    appliesWhen: { employsStaff: true },
    remediation: "Generate the job description acknowledgement under Forms and have it signed.",
  },
  {
    code: "employee_dementia_training",
    regulationCite: "WAC 388-76-10495",
    title: "Dementia specialty training completed",
    severity: "HIGH",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "specialty_dementia_training",
    appliesWhen: { employsStaff: true, specialtiesIncludeAny: ["DEMENTIA"] },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation:
      "Staff in a dementia-designated home need the specialty training on file before providing that care.",
  },
  {
    code: "employee_mh_training",
    regulationCite: "WAC 388-76-10495",
    title: "Mental health specialty training completed",
    severity: "HIGH",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "specialty_mh_training",
    appliesWhen: { employsStaff: true, specialtiesIncludeAny: ["MENTAL_HEALTH"] },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation: "File the mental health specialty training certificate for each caregiver.",
  },
  {
    code: "employee_dd_training",
    regulationCite: "WAC 388-76-10495",
    title: "Developmental disabilities specialty training completed",
    severity: "HIGH",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "specialty_dd_training",
    appliesWhen: {
      employsStaff: true,
      specialtiesIncludeAny: ["DEVELOPMENTAL_DISABILITIES"],
    },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation:
      "File the developmental disabilities specialty training certificate for each caregiver.",
  },
  {
    code: "employee_nurse_delegation_training",
    regulationCite: "WAC 388-76-10430",
    title: "Nurse delegation training completed",
    severity: "HIGH",
    checkType: "PER_EMPLOYEE_DOCUMENT",
    documentTypeCode: "nurse_delegation_training",
    appliesWhen: { employsStaff: true, usesNurseDelegation: true },
    subjectWhen: { roleIn: CARE_STAFF },
    remediation:
      "Caregivers accepting delegated nursing tasks need core delegation training on file.",
  },
];
