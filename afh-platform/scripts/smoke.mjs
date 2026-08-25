/**
 * End-to-end smoke test.
 *
 *   npm run build && npm run db:reset
 *   npx next start -p 3111 &
 *   npm run smoke
 *
 * Drives a real browser through every feature area against the seeded demo
 * home: the compliance engine's applicability logic, the vault, the binder,
 * form generation through to a remote family signature, anonymous citation
 * posting with identifier scrubbing, the personalised digest, and cross-tenant
 * isolation. Exits non-zero on the first failed expectation.
 *
 * Set SMOKE_BASE_URL / SMOKE_CHROMIUM to point at a different server or browser.
 */

import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3111";
const EXE = process.env.SMOKE_CHROMIUM || "/opt/pw-browsers/chromium";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// Generous, because this also has to pass against `npm run dev`, where each
// route and server action compiles on first hit.
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS || 90000);

const browser = await chromium.launch({ executablePath: EXE });

/** Every context gets the same patience, including the ones opened mid-run. */
async function newPage(options = {}) {
  const context = await browser.newContext({ baseURL: BASE, ...options });
  context.setDefaultTimeout(TIMEOUT);
  context.setDefaultNavigationTimeout(TIMEOUT);
  return { context, page: await context.newPage() };
}

const { page } = await newPage();

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 500) pageErrors.push(`${r.status()} ${r.url()}`);
});

try {
  // ---- public pages ----
  await page.goto("/", { waitUntil: "domcontentloaded" });
  check("landing renders", (await page.title()).includes("AFH Compliance"));

  await page.goto("/citations", { waitUntil: "domcontentloaded" });
  const citationCount = await page.locator("main li a[href^='/citations/']").count();
  check("citation board is public and populated", citationCount >= 5, `${citationCount} posts`);

  await page.goto("/regulations", { waitUntil: "domcontentloaded" });
  check(
    "rule catalog flags unverified seed entries",
    (await page.getByText(/entries are unverified/).count()) > 0,
  );

  // ---- login ----
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill("#email", "demo@example.com");
  await page.fill("#password", "demo-password-123");
  await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit]")]);
  check("login redirects to dashboard", page.url().endsWith("/dashboard"));

  // ---- dashboard / compliance engine ----
  const scoreText = await page.locator("p.tabular-nums").first().innerText();
  const score = parseInt(scoreText, 10);
  check("readiness score computed", Number.isFinite(score) && score > 0 && score < 100, scoreText);

  const failingText = await page.locator("p.tabular-nums").nth(1).innerText();
  check("open findings detected", parseInt(failingText, 10) > 0, `${failingText} failing`);

  const bodyText = await page.locator("body").innerText();
  check(
    "per-resident findings name the resident",
    /Ana Reyes|David Petrov|Margaret Oyelaran/.test(bodyText),
  );
  check("remediation guidance shown", bodyText.includes("To fix:"));
  check(
    "rule-change impact evaluated against home",
    /gaps? at your home|You already comply|No automatic check/.test(bodyText),
  );

  // Applicability: Margaret self-administers, so she must NOT be asked for a MAR
  // but MUST be asked for a self-administration assessment.
  await page.goto("/residents", { waitUntil: "domcontentloaded" });
  const margaretHref = await page
    .locator("a", { hasText: "Margaret Oyelaran" })
    .first()
    .getAttribute("href");
  await page.goto(margaretHref, { waitUntil: "domcontentloaded" });
  const margaret = await page.locator("body").innerText();
  check(
    "long-term resident's renewed care plan is not flagged as late",
    !/Negotiated care plan current[\s\S]{0,200}past the 30-day deadline/.test(margaret),
  );
  check(
    "self-administering resident is asked for a self-admin assessment",
    margaret.includes("Self-administration assessment on file"),
  );
  check(
    "self-administering resident is NOT asked for a MAR",
    !margaret.includes("Medication administration record current"),
  );

  // ---- documents ----
  await page.goto("/documents", { waitUntil: "domcontentloaded" });
  const docRows = await page.locator("table tbody tr").count();
  check("vault lists documents", docRows > 20, `${docRows} rows`);

  // ---- binder ----
  await page.goto("/binder", { waitUntil: "domcontentloaded" });
  const binder = await page.locator("body").innerText();
  check("binder has a cover sheet", binder.includes("Cedar Grove Adult Family Home"));
  check("binder has per-resident tabs", /Tab 2 · Resident/.test(binder));
  check("binder has per-employee tabs", /Tab \d+ · Employee/.test(binder));

  // ---- forms: create, fill, sign ----
  await page.goto("/forms", { waitUntil: "domcontentloaded" });
  check("form templates listed", (await page.getByText("Negotiated care plan").count()) > 0);

  const startHref = await page
    .locator("li", { hasText: "Resident rights acknowledgement" })
    .locator("a", { hasText: "Start" })
    .first()
    .getAttribute("href");
  await page.goto(startHref, { waitUntil: "domcontentloaded" });
  check("form fill page renders dynamic fields", (await page.locator("#residentId").count()) === 1);

  await page.selectOption("#residentId", { label: "Ana Reyes" });
  await page.fill("input[name='field.provided_date']", "2026-08-01");
  await page.fill("input[name='field.explained_by']", "Grace Mensah");
  await page.check("input[name='field.topics'][value='Privacy']");
  await page.check("input[name='field.topics'][value='Dignity and respect']");
  await Promise.all([
    page.waitForURL("**/forms/instances/**"),
    page.locator("button", { hasText: "Create form" }).click(),
  ]);
  const instanceUrl = page.url();
  check("form instance created", instanceUrl.includes("/forms/instances/"));

  const rendered = await page.locator("body").innerText();
  check("token substitution filled the document", rendered.includes("Ana Reyes"));
  check("home context token resolved", rendered.includes("Cedar Grove Adult Family Home"));
  check("checklist values rendered into body", rendered.includes("Dignity and respect"));

  // Sign as the provider (internal signer).
  await page.fill("input[name='typedName']", "Grace Mensah");
  await page.locator("form", { has: page.locator("input[name='typedName']") })
    .locator("input[type=checkbox]")
    .check();
  await Promise.all([
    page.waitForURL("**signed=1**"),
    page.locator("button", { hasText: "Sign as Provider or resident manager" }).click(),
  ]);
  const afterSign = await page.locator("body").innerText();
  check("internal signature recorded", afterSign.includes("Signed"));

  // Request a remote signature and capture the tokenized link.
  const remoteForm = page.locator("form", { has: page.locator("input[name='signerEmail']") }).first();
  await remoteForm.locator("input[name='signerName']").fill("Elena Reyes");
  await remoteForm.locator("input[name='signerEmail']").fill("family@example.com");
  await Promise.all([
    page.waitForURL("**requested=**"),
    remoteForm.locator("button[type=submit]").click(),
  ]);
  // Reload rather than reading the post-action render: the signing link has to
  // be retrievable whenever the provider comes back to the form, not only in
  // the flash message.
  await page.goto(instanceUrl, { waitUntil: "domcontentloaded" });
  const banner = await page.locator("body").innerText();
  const linkMatch = banner.match(/http:\/\/localhost:3000\/sign\/([A-Za-z0-9_-]+)/);
  check("signing link retrievable from the form page", Boolean(linkMatch), linkMatch ? "token shown" : "no link");
  check(
    "optional signature request does not un-complete a filed form",
    banner.includes("A copy is filed in the vault"),
  );

  // ---- remote signing, in a clean context with no session ----
  if (linkMatch) {
    const { context: anon, page: anonPage } = await newPage();
    await anonPage.goto(`/sign/${linkMatch[1]}`, { waitUntil: "domcontentloaded" });
    const signPage = await anonPage.locator("body").innerText();
    check("remote signer sees the document without an account", signPage.includes("Ana Reyes"));
    check("remote signer sees who sent it", signPage.includes("Cedar Grove Adult Family Home"));

    await anonPage.fill("input[name='typedName']", "Elena Reyes");
    await anonPage.locator("input[type=checkbox]").check();
    await Promise.all([
      anonPage.waitForURL("**done=1**"),
      anonPage.locator("button[type=submit]").click(),
    ]);
    check("remote signature accepted", (await anonPage.locator("body").innerText()).includes("Thank you"));

    // Token must be burned after use.
    await anonPage.goto(`/sign/${linkMatch[1]}`, { waitUntil: "domcontentloaded" });
    check(
      "signing link is single-use",
      (await anonPage.locator("body").innerText()).includes("no longer valid"),
    );
    await anon.close();
  }

  // Completing all required signers should file the form into the vault.
  await page.goto(instanceUrl, { waitUntil: "domcontentloaded" });
  const completed = await page.locator("body").innerText();
  check("form completed after required signatures", completed.includes("Completed"));
  check("completed form filed into the vault", completed.includes("A copy is filed in the vault"));

  await page.goto("/documents?scope=RESIDENT", { waitUntil: "domcontentloaded" });
  check(
    "generated form appears in the vault",
    (await page.getByText("Resident rights acknowledgement").count()) > 0,
  );

  // ---- citation posting + scrubbing + self-check ----
  await page.goto("/citations/new", { waitUntil: "domcontentloaded" });
  await page.fill("#summary", "Fire safety inspection had lapsed at the time of the visit");
  await page.fill("#wacCite", "388-76-10191");
  await page.fill(
    "#narrative",
    "Call me on 253-555-0140 or email me at owner@cedargrove.example.com if you want the details. Our license 12345678 was checked.",
  );
  await Promise.all([
    // Not "**/citations/**" — that also matches the /citations/new page we are
    // already on, so the wait would resolve before the post happened.
    page.waitForURL(/\/citations\/[a-z0-9]{20,}\?/),
    page.locator("button", { hasText: "Submit for review" }).click(),
  ]);
  const posted = await page.locator("body").innerText();
  check("identifiers stripped from citation narrative", posted.includes("[phone removed]") && posted.includes("[email removed]"));
  check("scrub is disclosed to the author", /identifying detail/.test(posted));
  check("post held for moderation", posted.includes("Awaiting moderation"));
  check(
    "self-check runs the cited rule against the poster's own home",
    /gaps? against this rule|You look covered/.test(posted),
  );

  // ---- moderation (demo user is ADMIN) ----
  await page.goto("/admin/moderation", { waitUntil: "domcontentloaded" });
  check("moderation queue reachable by admin", (await page.getByText("awaiting review").count()) > 0);

  // ---- subscriptions + digest ----
  await page.goto("/subscriptions", { waitUntil: "domcontentloaded" });
  await page.check("input[value='COMPLIANCE_GAPS']");
  await page.check("input[value='EXPIRY_DIGEST']");
  await Promise.all([
    page.waitForURL("**subscribed=**"),
    page.getByRole("button", { name: "Subscribe", exact: true }).click(),
  ]);
  check("subscription created", page.url().includes("subscribed="));

  await Promise.all([
    page.waitForURL("**/admin/outbox**"),
    page.locator("button", { hasText: "Generate a digest now" }).first().click(),
  ]);
  const outbox = await page.locator("body").innerText();
  check("digest generated into the outbox", outbox.includes("AFH Compliance"));
  check(
    "digest is personalised with real findings",
    /gaps? at your home|open compliance gap|expiring soon/i.test(outbox),
  );
  check(
    "digest names the specific missing records",
    /Ana Reyes|David Petrov|Priya Raman|Tomas Lindqvist/.test(outbox),
  );

  // ---- tenant isolation ----
  const { context: other, page: otherPage } = await newPage();
  await otherPage.goto("/register", { waitUntil: "domcontentloaded" });
  await otherPage.fill("#name", "Second Provider");
  await otherPage.fill("#email", "second@example.com");
  await otherPage.fill("#password", "another-password-123");
  await Promise.all([
    otherPage.waitForURL("**/onboarding"),
    otherPage.click("button[type=submit]"),
  ]);
  await otherPage.fill("#name", "Birchwood AFH");
  await Promise.all([
    otherPage.waitForURL("**/dashboard"),
    otherPage.locator("button", { hasText: "Create my home" }).click(),
  ]);
  check("second home onboarded", otherPage.url().endsWith("/dashboard"));

  const secondDash = await otherPage.locator("body").innerText();
  check(
    "second home sees none of the first home's residents",
    !/Ana Reyes|Margaret Oyelaran|David Petrov/.test(secondDash),
  );

  // Direct-id access to another home's resident must 404.
  const residentHref = await page.evaluate(async () => {
    const res = await fetch("/residents");
    const html = await res.text();
    return (html.match(/\/residents\/([a-z0-9]{20,})/) || [])[0] ?? null;
  });
  if (residentHref) {
    const resp = await otherPage.goto(residentHref, { waitUntil: "domcontentloaded" });
    check("cross-tenant resident access blocked", resp?.status() === 404, `status ${resp?.status()}`);
  }
  await other.close();

  check("no unhandled page errors or 5xx responses", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
} catch (err) {
  check("smoke run completed without throwing", false, String(err).split("\n")[0]);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
  process.exit(1);
}
