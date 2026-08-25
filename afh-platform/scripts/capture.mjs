/**
 * Drive the running app and capture the key screens.
 *
 *   npm run dev &
 *   node scripts/capture.mjs
 *
 * Writes PNGs to ./screens/. Unlike scripts/smoke.mjs this is not a test — it
 * walks the same flows a provider would and photographs the result, so the
 * output can be reviewed without access to the running server.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";
const EXE = process.env.SMOKE_CHROMIUM || "/opt/pw-browsers/chromium";
const OUT = "screens";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e}`));
page.on("response", (r) => {
  if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
});

let n = 0;
async function shot(name, { full = true } = {}) {
  n++;
  const file = `${OUT}/${String(n).padStart(2, "0")}-${name}.png`;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: file, fullPage: full });
  console.log(`captured ${file}`);
  return file;
}

// Dev mode compiles each route on first hit.
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(60000);

// ---------------------------------------------------------------- public
await page.goto("/", { waitUntil: "domcontentloaded" });
await shot("landing");

await page.goto("/citations", { waitUntil: "domcontentloaded" });
await shot("citation-board-public");

// ---------------------------------------------------------------- sign in
await page.goto("/login", { waitUntil: "domcontentloaded" });
await page.fill("#email", "demo@example.com");
await page.fill("#password", "demo-password-123");
await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit]")]);
await shot("dashboard");

// ------------------------------------------------------- per-subject view
await page.goto("/residents", { waitUntil: "domcontentloaded" });
const davidHref = await page
  .locator("a", { hasText: "David Petrov" })
  .first()
  .getAttribute("href");
// David was admitted 12 days ago, so his file shows the live admission-deadline
// requirements rather than a settled record.
await page.goto(davidHref, { waitUntil: "domcontentloaded" });
await shot("resident-file-new-admission");

await page.goto("/employees", { waitUntil: "domcontentloaded" });
const priyaHref = await page
  .locator("a", { hasText: "Priya Raman" })
  .first()
  .getAttribute("href");
await page.goto(priyaHref, { waitUntil: "domcontentloaded" });
await shot("employee-file-missing-checks");

// ---------------------------------------------------------------- vault
await page.goto("/documents", { waitUntil: "domcontentloaded" });
await shot("document-vault");

// ---------------------------------------------------------------- binder
await page.goto("/binder", { waitUntil: "domcontentloaded" });
await shot("inspection-binder");

// ----------------------------------------------------- forms end to end
await page.goto("/forms", { waitUntil: "domcontentloaded" });
await shot("form-templates");

const startHref = await page
  .locator("li", { hasText: "Negotiated care plan" })
  .locator("a", { hasText: "Start" })
  .first()
  .getAttribute("href");
await page.goto(startHref, { waitUntil: "domcontentloaded" });
await page.selectOption("#residentId", { label: "David Petrov" });
await page.check("input[name='field.plan_type'][value='Initial']");
await page.fill("input[name='field.review_date']", "2027-08-25");
await page.fill(
  "textarea[name='field.participants']",
  "David Petrov; his sister Elena Petrova (representative); Grace Mensah (provider).",
);
await page.fill(
  "textarea[name='field.mobility']",
  "Walks independently indoors. Uses a cane outdoors and on stairs. No transfer assistance needed.",
);
await page.fill(
  "textarea[name='field.adls']",
  "Independent with dressing and grooming. Standby assistance for bathing because of unsteadiness stepping into the tub.",
);
await page.fill(
  "textarea[name='field.medications']",
  "Staff administer all medications from a blister pack. Evening dose is the one he most often declines; offer again after supper before recording a refusal.",
);
await page.fill(
  "textarea[name='field.risks']",
  "Falls risk in the bathroom: non-slip mat in place, staff remain within earshot. Low mood in the evenings: check in at 19:00 and offer a call to his sister.",
);
await page.fill("input[name='field.emergency_contact']", "Elena Petrova, sister");
await page.fill("input[name='field.practitioner']", "Dr. A. Whitfield, Tacoma Family Medicine");
await shot("form-fill");

await Promise.all([
  page.waitForURL("**/forms/instances/**"),
  page.locator("button", { hasText: "Create form" }).click(),
]);
const instanceUrl = page.url();
await shot("form-generated");

// Sign as the provider, drawing on the signature canvas.
await page.fill("input[name='typedName']", "Grace Mensah");
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.move(box.x + 30, box.y + box.height * 0.65);
  await page.mouse.down();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    await page.mouse.move(
      box.x + 30 + t * (box.width - 90),
      box.y + box.height * (0.62 - Math.sin(t * Math.PI * 2.4) * 0.22),
    );
  }
  await page.mouse.up();
}
await page
  .locator("form", { has: page.locator("input[name='typedName']") })
  .locator("input[type=checkbox]")
  .check();
await shot("signature-pad");

await Promise.all([
  page.waitForURL("**signed=1**"),
  page.locator("button", { hasText: "Sign as Provider or resident manager" }).click(),
]);
await shot("form-signed-by-provider");

// Issue a signing link for the family member.
const remoteForm = page
  .locator("form", { has: page.locator("input[name='signerEmail']") })
  .first();
await remoteForm.locator("input[name='signerName']").fill("Elena Petrova");
await remoteForm.locator("input[name='signerEmail']").fill("elena@example.com");
await Promise.all([
  page.waitForURL("**requested=**"),
  remoteForm.locator("button[type=submit]").click(),
]);
await page.goto(instanceUrl, { waitUntil: "domcontentloaded" });
const withLink = await page.locator("body").innerText();
const token = (withLink.match(/\/sign\/([A-Za-z0-9_-]+)/) || [])[1];
await shot("signing-link-issued");

// The family member's view, on a phone, with no account.
if (token) {
  const phone = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 420, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const phonePage = await phone.newPage();
  await phonePage.goto(`/sign/${token}`, { waitUntil: "domcontentloaded" });
  await phonePage.waitForLoadState("networkidle").catch(() => {});
  n++;
  await phonePage.screenshot({
    path: `${OUT}/${String(n).padStart(2, "0")}-remote-signing-phone.png`,
    fullPage: true,
  });
  console.log(`captured ${OUT}/${String(n).padStart(2, "0")}-remote-signing-phone.png`);
  await phone.close();
}

// --------------------------------------------------- citations + self check
await page.goto("/citations", { waitUntil: "domcontentloaded" });
const citationHref = await page
  .locator("main li a[href^='/citations/']")
  .first()
  .getAttribute("href");
await page.goto(citationHref, { waitUntil: "domcontentloaded" });
await shot("citation-detail-self-check");

await page.goto("/citations/new", { waitUntil: "domcontentloaded" });
await page.fill("#summary", "Fire safety inspection had lapsed at the time of the visit");
await page.fill("#wacCite", "388-76-10191");
await page.fill(
  "#narrative",
  "The surveyor asked for the most recent fire inspection and ours was eleven months out of date. Call me on 253-555-0140 or email owner@cedargrove.example.com if you want the details.",
);
await page.fill(
  "#correctiveAction",
  "Booked the inspection the same week and put a recurring annual reminder in the calendar with a 90-day warning.",
);
await page.fill("#tags", "fire safety, expiry tracking");
await shot("citation-post-form");

await Promise.all([
  page.waitForURL(/\/citations\/[a-z0-9]{20,}\?/),
  page.locator("button", { hasText: "Submit for review" }).click(),
]);
await shot("citation-posted-scrubbed");

// ---------------------------------------------------------------- updates
await page.goto("/updates", { waitUntil: "domcontentloaded" });
await shot("rule-updates-personalised");

// ------------------------------------------------------ digest end to end
await page.goto("/subscriptions", { waitUntil: "domcontentloaded" });
await page.check("input[value='COMPLIANCE_GAPS']");
await page.check("input[value='EXPIRY_DIGEST']");
await Promise.all([
  page.waitForURL("**subscribed=**"),
  page.getByRole("button", { name: "Subscribe", exact: true }).click(),
]);
await Promise.all([
  page.waitForURL("**/admin/outbox**"),
  page.locator("button", { hasText: "Generate a digest now" }).first().click(),
]);
await shot("digest-outbox");

// --------------------------------------------------------------- catalog
await page.goto("/regulations", { waitUntil: "domcontentloaded" });
await shot("rule-catalog-unverified");

await browser.close();

console.log(`\n${n} screens captured to ./${OUT}/`);
if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of problems.slice(0, 10)) console.log(`  ${p}`);
  process.exit(1);
}
console.log("No page errors or 5xx responses.");
