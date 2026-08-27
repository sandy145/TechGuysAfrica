/**
 * End-to-end smoke test.
 *
 *   npm run build && npm run db:reset
 *   npx next start -p 3131 &
 *   npm run smoke
 *
 * Drives a real browser through the path the product exists for: a provider
 * uploads a document, the licensor's queue surfaces it, the citation is
 * refused while it sits unread, and permitted only once it has been opened and
 * reviewed. Also checks tenancy isolation and the printed evidence index.
 *
 * Exits non-zero on the first failed expectation.
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3131";
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS || 90000);
const PASSWORD = "Exchange2026!";

/**
 * Browser resolution, in order: an explicit SMOKE_CHROMIUM, then a
 * pre-provisioned browser if one happens to be on this machine, then
 * Playwright's own download. CI has the third; a sandbox usually has the
 * second; a developer debugging a specific build passes the first.
 */
function browserPath() {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;
  const provisioned = "/opt/pw-browsers/chromium";
  return existsSync(provisioned) ? provisioned : undefined;
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const executablePath = browserPath();
const browser = await chromium.launch(executablePath ? { executablePath } : {});

async function session(email) {
  const context = await browser.newContext({ baseURL: BASE });
  context.setDefaultTimeout(TIMEOUT);
  context.setDefaultNavigationTimeout(TIMEOUT);
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(dashboard|portal)/);
  return { context, page };
}

const tmp = path.join(os.tmpdir(), `evidence-smoke-${Date.now()}.txt`);
await fs.writeFile(tmp, "Dementia specialty training certificate — smoke test upload.\n");

try {
  // ---------------------------------------------------------------- provider
  const provider = await session("adeline@cedargroveafh.example");
  const pp = provider.page;

  check("provider lands in the portal", pp.url().includes("/portal"));
  const findingLinks = await pp.locator("a[href^='/portal/findings/']").count();
  check("provider sees their shared findings", findingLinks >= 5, `${findingLinks} links`);

  // F-03 is the finding with nothing submitted yet.
  const f03 = pp.locator("li", { hasText: "F-03" }).locator("a[href^='/portal/findings/']").first();
  await f03.click();
  await pp.waitForURL(/\/portal\/findings\//);
  const findingUrl = pp.url();
  check("provider can open a finding", await pp.locator("text=What the licensor recorded").isVisible());

  await pp.setInputFiles("input[type=file]", tmp);
  await pp.fill("textarea[name=note]", "Both certificates attached — smoke test.");
  await pp.click("button:has-text('Submit to my licensor')");
  await pp.waitForSelector("text=Received —");
  check("upload produces an immediate receipt", true);
  check(
    "provider sees the file is not yet opened",
    await pp.locator("text=Not opened yet").first().isVisible(),
  );

  // --------------------------------------------------------------- inspector
  const inspector = await session("inspector@example.wa.gov");
  const ip = inspector.page;

  const queueText = await ip.locator("main").innerText();
  check("dashboard surfaces unreviewed evidence", /unreviewed/i.test(queueText));

  await ip.goto("/review", { waitUntil: "domcontentloaded" });
  const reviewText = await ip.locator("main").innerText();
  check("review queue lists the new submission", reviewText.includes("Cedar Grove"));
  check("review queue flags files never opened", reviewText.includes("never opened"));

  // Open the seeded F-01 — the scenario's unread CPR card.
  await ip.goto("/inspections", { waitUntil: "domcontentloaded" });
  await ip.click("a:has-text('Cedar Grove')");
  await ip.waitForURL(/\/inspections\//);
  await ip.click("a:has-text('WAC 388-76-10425')");
  await ip.waitForURL(/\/findings\//);
  const findingPage = ip.url();

  check(
    "finding warns that unreviewed evidence exists",
    await ip.locator("text=The provider has sent documentation you have not reviewed").isVisible(),
  );

  await ip.check("input[value=CITATION]");
  check(
    "citation is blocked while evidence is unread",
    await ip.locator("text=A citation cannot be recorded on this finding yet").isVisible(),
  );
  const disabled = await ip.locator("button:has-text('Record citation')").isDisabled();
  check("the citation button is disabled", disabled);

  // Marking reviewed is refused while a file has never been opened.
  await ip.click("button:has-text('Mark reviewed')");
  await ip.waitForSelector("text=before marking this reviewed");
  check("review is refused while a file has never been opened", true);

  // Open every file on the finding, which is what the gate is watching for.
  const fileLinks = await ip.locator("a[href^='/api/files/']").evaluateAll((els) =>
    els.map((e) => e.getAttribute("href")),
  );
  // Navigated rather than fetched: Playwright's request context will not send
  // a Secure session cookie over plain http, and this is what a click does.
  for (const href of fileLinks) {
    const res = await ip.goto(href, { waitUntil: "domcontentloaded" });
    if (!res || !res.ok()) throw new Error(`file fetch failed: ${href} ${res?.status()}`);
  }
  check("evidence files can be retrieved", fileLinks.length >= 2, `${fileLinks.length} files`);

  await ip.goto(findingPage, { waitUntil: "domcontentloaded" });
  check("files now show as opened", await ip.locator("text=Opened").first().isVisible());

  await ip.fill("input[name=reviewNote]", "CPR card confirms certification current on the survey date.");
  await ip.click("button:has-text('Mark reviewed')");
  // On success the form is replaced by the reviewed state, so the badge — not
  // the flash message — is what to wait for.
  await ip.waitForSelector("text=Reviewed by Marisol Reyes");
  check("submission can be marked reviewed once opened", true);

  // Now the same finding resolves to no deficiency on the evidence.
  await ip.check("input[value=NO_DEFICIENCY]");
  await ip.fill(
    "textarea[name=rationale]",
    "The certification submitted was in effect on the date of survey. The requirement was met; the card was filed in the wrong binder.",
  );
  await ip.click("button:has-text('Record no deficiency')");
  await ip.waitForSelector("text=Decided by");
  check("determination records once the evidence has been read", true);

  const afterText = await ip.locator("main").innerText();
  check("determination snapshots the evidence considered", afterText.includes("frozen"));

  // ----------------------------------------------------------- two-source gate
  await ip.goto("/inspections", { waitUntil: "domcontentloaded" });
  await ip.click("a:has-text('Harborview')");
  await ip.waitForURL(/\/inspections\//);
  const harborText = await ip.locator("main").innerText();
  check("draft findings show their source count", /0?1\/2 evidence sources/.test(harborText));

  // -------------------------------------------------------------- isolation
  const other = await session("tomas@willowcreekafh.example");
  const res = await other.page.goto(findingUrl, { waitUntil: "domcontentloaded" });
  check("a provider cannot open another home's finding", res?.status() === 404, `status ${res?.status()}`);

  const fileRes = await other.page.goto(fileLinks[0], { waitUntil: "domcontentloaded" });
  check(
    "a provider cannot fetch another home's evidence",
    fileRes?.status() === 404,
    `status ${fileRes?.status()}`,
  );

  // ------------------------------------------------------------- SOD packet
  const sup = await session("supervisor@example.wa.gov");
  await sup.page.goto("/oversight", { waitUntil: "domcontentloaded" });
  const oversight = await sup.page.locator("main").innerText();
  check("oversight reports determination mix", oversight.includes("Determination mix by licensor"));

  await sup.page.goto("/inspections", { waitUntil: "domcontentloaded" });
  await sup.page.click("a:has-text('Willow Creek')");
  await sup.page.waitForURL(/\/inspections\//);
  await sup.page.click("a:has-text('Statement of deficiencies')");
  await sup.page.waitForURL(/\/sod\//);
  // Headings are uppercased in CSS, so innerText comes back shouting.
  const sod = (await sup.page.locator("main").innerText()).toLowerCase();
  check("statement prints the citation", sod.includes("citations (1)"));
  check("statement carries an evidence index", sod.includes("evidence index"));
  check("statement carries the activity record", sod.includes("record of activity"));
} finally {
  await browser.close();
  await fs.rm(tmp, { force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
