/**
 * Capture compressed JPEGs of the running app for embedding in a shareable
 * page. Separate from capture.mjs, which produces full-resolution PNGs for
 * review — these are sized to survive an upload.
 */

import { chromium } from "playwright";
import { mkdir, stat } from "node:fs/promises";

const BASE = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";
const EXE = process.env.SMOKE_CHROMIUM || "/opt/pw-browsers/chromium";
const OUT = "screens/web";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
ctx.setDefaultTimeout(90000);
ctx.setDefaultNavigationTimeout(90000);
const page = await ctx.newPage();

/** Tall pages are clipped: a 9000px strip is unreadable once scaled to fit. */
async function shot(name, { height = 2400 } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const full = await page.evaluate(() => document.body.scrollHeight);
  const clipHeight = Math.min(full, height);
  await page.screenshot({
    path: `${OUT}/${name}.jpg`,
    type: "jpeg",
    quality: 72,
    clip: { x: 0, y: 0, width: 1280, height: clipHeight },
  });
  const { size } = await stat(`${OUT}/${name}.jpg`);
  console.log(`${name}.jpg  ${(size / 1024).toFixed(0)} KB`);
}

await page.goto("/login", { waitUntil: "domcontentloaded" });
await page.fill("#email", "demo@example.com");
await page.fill("#password", "demo-password-123");
await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit]")]);
await shot("dashboard", { height: 2100 });

await page.goto("/residents", { waitUntil: "domcontentloaded" });
const david = await page.locator("a", { hasText: "David Petrov" }).first().getAttribute("href");
await page.goto(david, { waitUntil: "domcontentloaded" });
await shot("resident", { height: 1700 });

await page.goto("/documents", { waitUntil: "domcontentloaded" });
await shot("vault", { height: 1700 });

await page.goto("/binder", { waitUntil: "domcontentloaded" });
await shot("binder", { height: 2000 });

await page.goto("/forms", { waitUntil: "domcontentloaded" });
await shot("forms", { height: 1500 });

// Build a signed care plan so the signature screens have real content.
const start = await page
  .locator("li", { hasText: "Negotiated care plan" })
  .locator("a", { hasText: "Start" })
  .first()
  .getAttribute("href");
await page.goto(start, { waitUntil: "domcontentloaded" });
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
await Promise.all([
  page.waitForURL("**/forms/instances/**"),
  page.locator("button", { hasText: "Create form" }).click(),
]);
const instanceUrl = page.url();

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
await Promise.all([
  page.waitForURL("**signed=1**"),
  page.locator("button", { hasText: "Sign as Provider or resident manager" }).click(),
]);

const remoteForm = page.locator("form", { has: page.locator("input[name='signerEmail']") }).first();
await remoteForm.locator("input[name='signerName']").fill("Elena Petrova");
await remoteForm.locator("input[name='signerEmail']").fill("elena@example.com");
await Promise.all([
  page.waitForURL("**requested=**"),
  remoteForm.locator("button[type=submit]").click(),
]);
await page.goto(instanceUrl, { waitUntil: "domcontentloaded" });
await shot("form-signed", { height: 2300 });

const token = ((await page.locator("body").innerText()).match(/\/sign\/([A-Za-z0-9_-]+)/) || [])[1];
if (token) {
  const phone = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 430, height: 1400 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const phonePage = await phone.newPage();
  await phonePage.goto(`/sign/${token}`, { waitUntil: "domcontentloaded" });
  await phonePage.waitForLoadState("networkidle").catch(() => {});
  await phonePage.screenshot({
    path: `${OUT}/phone-signing.jpg`,
    type: "jpeg",
    quality: 72,
    fullPage: true,
  });
  const { size } = await stat(`${OUT}/phone-signing.jpg`);
  console.log(`phone-signing.jpg  ${(size / 1024).toFixed(0)} KB`);
  await phone.close();
}

await page.goto("/citations", { waitUntil: "domcontentloaded" });
await shot("citation-board", { height: 1700 });

const citation = await page
  .locator("main li a[href^='/citations/']")
  .first()
  .getAttribute("href");
await page.goto(citation, { waitUntil: "domcontentloaded" });
await shot("citation-selfcheck", { height: 2200 });

await page.goto("/updates", { waitUntil: "domcontentloaded" });
await shot("updates", { height: 1900 });

await page.goto("/regulations", { waitUntil: "domcontentloaded" });
await shot("catalog", { height: 1500 });

await browser.close();
console.log("done");
