// The knowledge base the assistant answers from.
//
// This is a hand-written scaffold for a test build, not an authoritative
// source. Each entry summarises how a service generally works and links to
// the agency that runs it. Fees, opening hours and document lists change, so
// the entries deliberately avoid quoting amounts, and every answer tells the
// citizen to confirm on the agency's own site. Before anything like this goes
// in front of the public, each entry must be reviewed by the owning agency.

export type Category =
  | "identity"
  | "travel"
  | "transport"
  | "tax-business"
  | "health-social"
  | "family"
  | "land-housing"
  | "education"
  | "safety-justice"
  | "utilities"
  | "civic";

export type Service = {
  slug: string;
  title: string;
  category: Category;
  agency: string;
  agencyUrl: string;
  summary: string;
  steps: string[];
  documents?: string[];
  notes?: string[];
  keywords: string[];
};

export const CATEGORIES: Record<Category, { label: string; blurb: string; icon: string }> = {
  identity: { label: "Identity & Ghana Card", blurb: "National ID, registration and updates", icon: "🪪" },
  travel: { label: "Passports & Immigration", blurb: "Passports, visas and residence permits", icon: "🛂" },
  transport: { label: "Driving & Vehicles", blurb: "Licences, registration and roadworthy", icon: "🚗" },
  "tax-business": { label: "Tax & Business", blurb: "TIN, filing returns and registering a company", icon: "💼" },
  "health-social": { label: "Health & Pensions", blurb: "NHIS, SSNIT and social support", icon: "🏥" },
  family: { label: "Births, Deaths & Marriage", blurb: "Civil registration certificates", icon: "👪" },
  "land-housing": { label: "Land & Housing", blurb: "Land title, search and registration", icon: "🏠" },
  education: { label: "Education", blurb: "School placement, results and scholarships", icon: "🎓" },
  "safety-justice": { label: "Safety & Justice", blurb: "Emergencies, police reports and clearance", icon: "🚓" },
  utilities: { label: "Water & Electricity", blurb: "Connections, bills and faults", icon: "💡" },
  civic: { label: "Voting & Civic Life", blurb: "Voter registration and elections", icon: "🗳️" },
};

export const SERVICES: Service[] = [
  {
    slug: "ghana-card",
    title: "Get a Ghana Card (National ID)",
    category: "identity",
    agency: "National Identification Authority (NIA)",
    agencyUrl: "https://nia.gov.gh",
    summary:
      "The Ghana Card is the national identity card for Ghanaian citizens and legally resident foreigners. Its Personal ID Number (PIN, e.g. GHA-XXXXXXXXX-X) is used across government services, including as the individual Tax Identification Number and for SIM, bank, NHIS and SSNIT records.",
    steps: [
      "Check the NIA website for current registration centres and whether you can pre-register online to save time.",
      "Go to an NIA registration centre with your supporting documents.",
      "Have your biometrics (photo, fingerprints, signature) captured.",
      "Keep the registration slip; you will be told when and where to collect the card.",
    ],
    documents: [
      "Birth certificate or valid Ghanaian passport (citizens)",
      "Alternatively, a relative with a Ghana Card may vouch for you, per NIA rules",
      "Residence permit and passport (foreign residents)",
    ],
    notes: [
      "Replacing a lost or damaged card, or correcting details, is also done through NIA.",
      "Never share your full PIN with unsolicited callers or on social media.",
    ],
    keywords: ["ghana card", "national id", "nia", "identity", "pin", "id card", "replace card", "lost card"],
  },
  {
    slug: "passport",
    title: "Apply for or renew a Ghanaian passport",
    category: "travel",
    agency: "Passport Office, Ministry of Foreign Affairs",
    agencyUrl: "https://passport.mfa.gov.gh",
    summary:
      "Ghanaian passports are issued by the Passport Office under the Ministry of Foreign Affairs. Applications begin online, followed by an appointment at a Passport Application Centre for biometrics.",
    steps: [
      "Start an application on the Passport Office online portal and choose standard or expedited processing.",
      "Pay the applicable fee through the portal's payment options.",
      "Book an appointment at a Passport Application Centre (or a mission abroad).",
      "Attend with your documents for biometric capture.",
      "Track the application online and collect the passport when notified.",
    ],
    documents: [
      "Ghana Card",
      "Birth certificate",
      "Previous passport (for renewals)",
      "Parental consent and parents' IDs (for minors)",
    ],
    notes: ["Fees and processing times change; confirm current amounts on the portal before paying."],
    keywords: ["passport", "renew passport", "travel document", "mfa", "biometric", "expedited"],
  },
  {
    slug: "visa-residence-permit",
    title: "Visas and residence permits for foreign nationals",
    category: "travel",
    agency: "Ghana Immigration Service (GIS)",
    agencyUrl: "https://gis.gov.gh",
    summary:
      "The Ghana Immigration Service handles entry visas, visa extensions, residence and work permits for foreign nationals in Ghana. Visas for travel to Ghana are usually applied for at a Ghana mission abroad or through the GIS online services.",
    steps: [
      "Confirm on the GIS website which permit or visa applies to your situation.",
      "Complete the application form and gather the listed supporting documents.",
      "Submit at a GIS office, online service, or Ghana mission abroad, and pay the fee.",
      "Attend any interview or biometric appointment and collect the decision.",
    ],
    keywords: ["visa", "residence permit", "work permit", "immigration", "gis", "foreigner", "extension"],
  },
  {
    slug: "drivers-licence",
    title: "Get or renew a driver's licence",
    category: "transport",
    agency: "Driver and Vehicle Licensing Authority (DVLA)",
    agencyUrl: "https://dvla.gov.gh",
    summary:
      "DVLA issues learner's permits and driving licences after the required tests, and renews and replaces licences. Many steps can be started online through DVLA's digital services.",
    steps: [
      "Obtain a learner's permit from DVLA (usually after an eye test and theory requirements).",
      "Train with an accredited driving school.",
      "Book and pass the driving test.",
      "Pay the licence fee and have your photo and biometrics captured.",
      "For renewals, apply before expiry online or at a DVLA office.",
    ],
    documents: ["Ghana Card", "Medical/eye test report", "Learner's permit (for new licences)"],
    keywords: ["driver's licence", "drivers license", "driving licence", "dvla", "learner", "driving test", "renew licence"],
  },
  {
    slug: "vehicle-registration",
    title: "Register a vehicle and renew roadworthy",
    category: "transport",
    agency: "Driver and Vehicle Licensing Authority (DVLA)",
    agencyUrl: "https://dvla.gov.gh",
    summary:
      "New and imported vehicles must be registered with DVLA, and registered vehicles need periodic roadworthy certification and valid insurance.",
    steps: [
      "Clear the vehicle through customs (imports) and keep the customs documents.",
      "Arrange vehicle insurance.",
      "Present the vehicle and documents at DVLA for inspection and registration.",
      "Renew roadworthy certification on schedule at DVLA or an approved testing station.",
      "Transfer ownership through DVLA when buying or selling a used vehicle.",
    ],
    documents: ["Ghana Card", "Customs clearance documents (imports)", "Insurance certificate", "Proof of ownership"],
    keywords: ["vehicle registration", "car registration", "roadworthy", "number plate", "transfer ownership", "dvla"],
  },
  {
    slug: "tin",
    title: "Get a Tax Identification Number (TIN)",
    category: "tax-business",
    agency: "Ghana Revenue Authority (GRA)",
    agencyUrl: "https://gra.gov.gh",
    summary:
      "For individuals, the Ghana Card PIN serves as the Tax Identification Number. Companies and other entities obtain a TIN through the Ghana Revenue Authority, typically linked to their business registration.",
    steps: [
      "Individuals: register for the Ghana Card; your PIN is used as your TIN.",
      "Make sure your Ghana Card PIN is linked on the GRA taxpayer portal before filing.",
      "Businesses: register with the Office of the Registrar of Companies, then confirm the entity TIN with GRA.",
    ],
    keywords: ["tin", "tax identification number", "gra", "tax number", "taxpayer"],
  },
  {
    slug: "file-taxes",
    title: "File and pay income tax",
    category: "tax-business",
    agency: "Ghana Revenue Authority (GRA)",
    agencyUrl: "https://gra.gov.gh",
    summary:
      "Self-employed people and businesses file returns and pay taxes to GRA, increasingly through the GRA online taxpayer portal. Employees usually have PAYE deducted by their employer.",
    steps: [
      "Log in to the GRA taxpayer portal with your Ghana Card PIN (individuals) or entity TIN.",
      "Select the relevant return (e.g. income tax, VAT) and period.",
      "Complete and submit the return before the deadline.",
      "Pay via the payment options listed on the portal and keep the receipt.",
    ],
    notes: ["Deadlines and rates change with each budget; check GRA notices for the current year."],
    keywords: ["file taxes", "income tax", "tax return", "pay tax", "vat", "paye", "gra portal"],
  },
  {
    slug: "register-business",
    title: "Register a business or company",
    category: "tax-business",
    agency: "Office of the Registrar of Companies (ORC)",
    agencyUrl: "https://orc.gov.gh",
    summary:
      "Sole proprietorships, partnerships and companies are registered with the Office of the Registrar of Companies under the Companies Act, 2019 (Act 992). Registration can be done online.",
    steps: [
      "Search and reserve a business name on the ORC online portal.",
      "Complete the registration forms for your business type and upload required documents.",
      "Pay the registration fee.",
      "Receive your certificate; then register for taxes with GRA and, if hiring, with SSNIT.",
      "File annual returns with ORC to keep the business in good standing.",
    ],
    documents: ["Ghana Card for owners/directors", "Business address details (digital address)", "Company constitution (optional for companies)"],
    keywords: ["register business", "business registration", "company", "orc", "registrar of companies", "sole proprietor", "incorporate", "annual returns"],
  },
  {
    slug: "nhis",
    title: "Register or renew NHIS health insurance",
    category: "health-social",
    agency: "National Health Insurance Authority (NHIA)",
    agencyUrl: "https://nhis.gov.gh",
    summary:
      "The National Health Insurance Scheme covers a defined benefits package at accredited facilities. Members register once and renew annually; many groups (e.g. children, the elderly, SSNIT contributors, pregnant women) are exempt from premiums but still renew.",
    steps: [
      "Register at an NHIS district office or through the NHIS mobile options, using your Ghana Card.",
      "Pay the premium and processing fee if you are not in an exempt group.",
      "Renew annually; renewal is available by dialling *929# on mobile.",
      "Present your Ghana Card or NHIS membership at accredited health facilities.",
    ],
    keywords: ["nhis", "health insurance", "nhia", "renew nhis", "*929#", "hospital", "medical cover"],
  },
  {
    slug: "ssnit",
    title: "SSNIT pension contributions and benefits",
    category: "health-social",
    agency: "Social Security and National Insurance Trust (SSNIT)",
    agencyUrl: "https://www.ssnit.org.gh",
    summary:
      "SSNIT runs the first tier of Ghana's pension scheme. Employers pay contributions for workers; self-employed people can contribute voluntarily. SSNIT pays retirement, invalidity and survivors' benefits.",
    steps: [
      "Your Ghana Card PIN is used as your SSNIT number; confirm your record is linked.",
      "Check your contribution statement through SSNIT's online or mobile services.",
      "Employers: register the business with SSNIT and submit monthly contribution reports.",
      "To claim a benefit, apply at a SSNIT branch or online with the required documents.",
    ],
    keywords: ["ssnit", "pension", "social security", "retirement", "contribution statement", "benefits"],
  },
  {
    slug: "birth-registration",
    title: "Register a birth and get a birth certificate",
    category: "family",
    agency: "Births and Deaths Registry",
    agencyUrl: "https://bdr.gov.gh",
    summary:
      "Every birth in Ghana should be registered with the Births and Deaths Registry. Registration within the first year is encouraged and is the basis for the birth certificate needed for school, passports and the Ghana Card.",
    steps: [
      "Obtain the weighing card or hospital notification of birth.",
      "Visit a Births and Deaths Registry office (or registration point at the health facility).",
      "Complete the registration form with the parents' details.",
      "Collect the birth certificate; late registration may require extra steps.",
    ],
    documents: ["Weighing card or hospital notification", "Parents' Ghana Cards"],
    keywords: ["birth certificate", "register birth", "birth registration", "newborn", "baby", "late registration"],
  },
  {
    slug: "death-registration",
    title: "Register a death",
    category: "family",
    agency: "Births and Deaths Registry",
    agencyUrl: "https://bdr.gov.gh",
    summary:
      "Deaths should be registered with the Births and Deaths Registry. A death certificate is required for burial permits, estate administration, pension and insurance claims.",
    steps: [
      "Obtain a medical certificate of cause of death from the hospital or doctor (or a police report where applicable).",
      "Report to a Births and Deaths Registry office with the deceased's details.",
      "Collect the death certificate and any burial permit required by the local assembly.",
    ],
    keywords: ["death certificate", "register death", "burial permit", "deceased", "funeral"],
  },
  {
    slug: "marriage-registration",
    title: "Register a marriage",
    category: "family",
    agency: "Registrar-General's Department",
    agencyUrl: "https://rgd.gov.gh",
    summary:
      "Marriages under the ordinance, as well as customary and Islamic marriages, can be registered so that couples hold an official marriage certificate.",
    steps: [
      "Give notice of the intended marriage at the Registrar's office or a licensed place of worship (ordinance marriages).",
      "Wait for the notice period to pass without objection.",
      "Conduct the marriage before a licensed officer and witnesses.",
      "For customary marriages, register the marriage at the relevant registry after it has taken place.",
    ],
    keywords: ["marriage certificate", "register marriage", "wedding", "customary marriage", "rgd"],
  },
  {
    slug: "land-title",
    title: "Search, register and title land",
    category: "land-housing",
    agency: "Lands Commission",
    agencyUrl: "https://lc.gov.gh",
    summary:
      "The Lands Commission keeps land records and registers titles and deeds. Conducting an official search before buying land is strongly advised to avoid disputes.",
    steps: [
      "Request an official search at the Lands Commission to confirm ownership and encumbrances.",
      "Have the site plan prepared by a licensed surveyor.",
      "Execute the indenture/lease and pay the applicable stamp duty.",
      "Submit for registration and track the application to completion.",
    ],
    notes: ["Be wary of land sold by unverified parties; always search first."],
    keywords: ["land title", "land search", "land registration", "lands commission", "buy land", "indenture", "site plan"],
  },
  {
    slug: "school-placement",
    title: "Senior High School placement (CSSPS)",
    category: "education",
    agency: "Ghana Education Service (GES)",
    agencyUrl: "https://cssps.gov.gh",
    summary:
      "After the BECE, students are placed into Senior High Schools through the Computerised School Selection and Placement System based on their choices and results.",
    steps: [
      "Choose schools during BECE registration in school.",
      "When results are released, check placement on the CSSPS portal using the index number and voucher/PIN as instructed.",
      "Follow the enrolment instructions for the placed school, or use self-placement if offered.",
    ],
    keywords: ["school placement", "cssps", "shs", "senior high", "bece", "placement results", "ges"],
  },
  {
    slug: "exam-results",
    title: "Check WASSCE/BECE results and verify certificates",
    category: "education",
    agency: "West African Examinations Council (WAEC) Ghana",
    agencyUrl: "https://www.waecgh.org",
    summary:
      "WAEC conducts BECE and WASSCE in Ghana. Results are checked online with a results checker, and certificates can be verified or replaced through WAEC.",
    steps: [
      "Buy a results checker card from an authorised vendor.",
      "Visit WAEC's results portal and enter your index number, exam year and checker details.",
      "For certificate verification or replacement, apply through WAEC's services.",
    ],
    keywords: ["waec", "wassce", "bece results", "exam results", "results checker", "certificate verification"],
  },
  {
    slug: "scholarships",
    title: "Government scholarships",
    category: "education",
    agency: "Ghana Scholarships Authority",
    agencyUrl: "https://scholarships.gov.gh",
    summary:
      "The Ghana Scholarships Authority manages government scholarships for local and foreign study. Calls for applications are published with eligibility criteria and deadlines.",
    steps: [
      "Watch for announcements on the Scholarships Authority website.",
      "Check eligibility for the specific scheme.",
      "Apply online with the required documents before the deadline.",
    ],
    keywords: ["scholarship", "bursary", "study abroad", "tuition", "scholarships authority"],
  },
  {
    slug: "emergency",
    title: "Emergency numbers",
    category: "safety-justice",
    agency: "National emergency services",
    agencyUrl: "https://police.gov.gh",
    summary:
      "In an emergency call 112, the national emergency number. Direct lines also exist: 191 for police, 192 for fire service and 193 for ambulance.",
    steps: [
      "Call 112 (national emergency number).",
      "Police: 191. Fire: 192. Ambulance: 193.",
      "Give your location (a GhanaPost digital address helps) and the nature of the emergency.",
    ],
    keywords: ["emergency", "112", "191", "192", "193", "police", "fire", "ambulance", "accident", "help"],
  },
  {
    slug: "police-report-clearance",
    title: "Police report or police clearance certificate",
    category: "safety-justice",
    agency: "Ghana Police Service",
    agencyUrl: "https://police.gov.gh",
    summary:
      "Report crimes or lost items at the nearest police station to obtain a police extract. A police clearance (criminal record) certificate, often required for jobs and travel, is processed through the Criminal Investigations Department.",
    steps: [
      "For a report: go to the nearest police station and make a statement; request an extract if you need one.",
      "For clearance: apply through the Ghana Police Service CID process, providing identification and fingerprints as required.",
      "Collect the certificate when processing is complete.",
    ],
    keywords: ["police report", "police clearance", "criminal record", "cid", "police extract", "lost item"],
  },
  {
    slug: "electricity",
    title: "Electricity connection, prepaid and faults",
    category: "utilities",
    agency: "Electricity Company of Ghana (ECG)",
    agencyUrl: "https://www.ecg.com.gh",
    summary:
      "ECG supplies electricity in the southern zones of Ghana (NEDCo serves the northern zones). Customers apply for new connections, buy prepaid credit, pay postpaid bills and report faults.",
    steps: [
      "Apply for a new service connection at an ECG office or through ECG's digital channels.",
      "Buy prepaid credit or pay postpaid bills via the ECG app, mobile money or vendors.",
      "Report outages and faults through the ECG call centre or app.",
    ],
    keywords: ["electricity", "ecg", "light bill", "prepaid", "power outage", "dumsor", "meter", "nedco"],
  },
  {
    slug: "water",
    title: "Water connection and bills",
    category: "utilities",
    agency: "Ghana Water Limited",
    agencyUrl: "https://www.gwcl.com.gh",
    summary:
      "Ghana's urban water utility handles new connections, billing and leak reports in towns and cities. Rural water is supported by the Community Water and Sanitation Agency.",
    steps: [
      "Apply for a new connection at a district office.",
      "Pay bills via the payment channels listed by the utility, including mobile money.",
      "Report leaks, bursts and supply problems to the customer service line.",
    ],
    keywords: ["water", "water bill", "gwcl", "ghana water", "leak", "pipe", "connection"],
  },
  {
    slug: "voter-registration",
    title: "Register to vote",
    category: "civic",
    agency: "Electoral Commission of Ghana",
    agencyUrl: "https://ec.gov.gh",
    summary:
      "Ghanaian citizens aged 18 and over can register to vote during registration exercises announced by the Electoral Commission. The Ghana Card is the primary document for registration.",
    steps: [
      "Watch for announced registration periods and centres from the Electoral Commission.",
      "Go to a registration centre with your Ghana Card.",
      "Have your biometrics captured and receive your voter ID card.",
      "Check the voter register during the exhibition period and report any errors.",
    ],
    keywords: ["vote", "voter registration", "voter id", "electoral commission", "election", "ec"],
  },
];

export function getService(slug: string): Service | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

export const MINISTRIES = [
  "Ministry of Finance",
  "Ministry of Health",
  "Ministry of Education",
  "Ministry of the Interior",
  "Ministry of Foreign Affairs",
  "Ministry of Roads and Highways",
  "Ministry of Food and Agriculture",
  "Ministry of Communications, Digital Technology and Innovations",
  "Ministry of Lands and Natural Resources",
  "Ministry of Trade, Agribusiness and Industry",
  "Ministry of Energy and Green Transition",
  "Ministry of Youth Development and Empowerment",
];
