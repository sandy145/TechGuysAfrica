/**
 * Assemble the shareable walkthrough page, inlining the captured JPEGs as data
 * URIs so the published page is entirely self-contained.
 *
 *   node scripts/capture-web.mjs && node scripts/build-walkthrough.mjs
 */

import { readFile, writeFile, stat } from "node:fs/promises";

const SHOTS = "screens/web";

async function dataUri(name) {
  const bytes = await readFile(`${SHOTS}/${name}.jpg`);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

const img = {};
for (const name of [
  "dashboard",
  "resident",
  "vault",
  "binder",
  "forms",
  "form-signed",
  "phone-signing",
  "citation-board",
  "citation-selfcheck",
  "updates",
  "catalog",
]) {
  img[name] = await dataUri(name);
}

function figure(src, caption, { tall = true } = {}) {
  return `<figure class="shot${tall ? " shot--tall" : ""}">
  <div class="shot__frame">
    <img src="${src}" alt="${caption.replace(/"/g, "&quot;")}" loading="lazy" />
    <button class="shot__expand" type="button">Expand</button>
  </div>
  <figcaption>${caption}</figcaption>
</figure>`;
}

const html = `<title>AFH Compliance Walkthrough</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" />

<style>
  :root {
    --ground: #f7f9f8;
    --surface: #ffffff;
    --surface-sunk: #eef3f1;
    --line: #dde5e2;
    --line-strong: #c3d1cc;
    --ink: #10201c;
    --ink-soft: #4a5b56;
    --ink-faint: #74847f;
    --accent: #1f6459;
    --accent-bright: #2f8a78;
    --accent-wash: #e8f2ef;
    --stop: #b42318;
    --stop-wash: #fdeceb;
    --warn: #97590b;
    --warn-wash: #fdf3e4;
    --ok: #166534;
    --ok-wash: #e7f3ec;
    --shadow: 0 1px 2px rgba(16, 32, 28, .06), 0 8px 24px -12px rgba(16, 32, 28, .18);
  }

  :root:not([data-theme="light"]) {
    @media (prefers-color-scheme: dark) {
      --ground: #0d1512;
      --surface: #131e1a;
      --surface-sunk: #0a110f;
      --line: #253630;
      --line-strong: #354a43;
      --ink: #e8f0ed;
      --ink-soft: #a4b8b1;
      --ink-faint: #7d918b;
      --accent: #5fbfa8;
      --accent-bright: #7fd4bf;
      --accent-wash: #16302a;
      --stop: #f5836f;
      --stop-wash: #341916;
      --warn: #e0a15a;
      --warn-wash: #2f2415;
      --ok: #6cc48c;
      --ok-wash: #14291d;
      --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 10px 30px -14px rgba(0, 0, 0, .7);
    }
  }

  :root[data-theme="dark"] {
    --ground: #0d1512;
    --surface: #131e1a;
    --surface-sunk: #0a110f;
    --line: #253630;
    --line-strong: #354a43;
    --ink: #e8f0ed;
    --ink-soft: #a4b8b1;
    --ink-faint: #7d918b;
    --accent: #5fbfa8;
    --accent-bright: #7fd4bf;
    --accent-wash: #16302a;
    --stop: #f5836f;
    --stop-wash: #341916;
    --warn: #e0a15a;
    --warn-wash: #2f2415;
    --ok: #6cc48c;
    --ok-wash: #14291d;
    --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 10px 30px -14px rgba(0, 0, 0, .7);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 17px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .wrap {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 24px 96px;
  }

  .col {
    max-width: 68ch;
  }

  /* ---------- masthead ---------- */

  header.masthead {
    border-bottom: 1px solid var(--line);
    padding: 56px 0 32px;
    margin-bottom: 40px;
  }

  .eyebrow {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 14px;
  }

  h1 {
    font-family: "Newsreader", Georgia, serif;
    font-weight: 500;
    font-size: clamp(34px, 5.4vw, 54px);
    line-height: 1.08;
    letter-spacing: -.015em;
    text-wrap: balance;
    margin: 0 0 18px;
  }

  .standfirst {
    font-family: "Newsreader", Georgia, serif;
    font-size: clamp(18px, 2.2vw, 21px);
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0;
    max-width: 60ch;
  }

  /* ---------- status ---------- */

  .status {
    display: grid;
    gap: 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--shadow);
    margin-bottom: 56px;
  }

  .status__row {
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: 20px;
    padding: 18px 22px;
    border-bottom: 1px solid var(--line);
    align-items: start;
  }
  .status__row:last-child { border-bottom: 0; }

  .status__key {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    padding-top: 3px;
  }

  .status__val { margin: 0; font-size: 15.5px; line-height: 1.55; }
  .status__val strong { font-weight: 600; }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 999px;
    padding: 3px 11px;
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: .01em;
    white-space: nowrap;
  }
  .pill--stop { background: var(--stop-wash); color: var(--stop); }
  .pill--ok   { background: var(--ok-wash);   color: var(--ok); }
  .pill--warn { background: var(--warn-wash); color: var(--warn); }
  .pill__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  /* ---------- sections ---------- */

  section { margin-bottom: 64px; }

  h2 {
    font-family: "Newsreader", Georgia, serif;
    font-weight: 500;
    font-size: clamp(25px, 3.2vw, 32px);
    line-height: 1.2;
    letter-spacing: -.01em;
    text-wrap: balance;
    margin: 0 0 12px;
    padding-top: 14px;
    border-top: 2px solid var(--ink);
  }

  h3 {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: .01em;
    margin: 40px 0 8px;
  }

  p { margin: 0 0 16px; }
  p.lede { color: var(--ink-soft); }

  a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
  a:focus-visible, button:focus-visible {
    outline: 2px solid var(--accent-bright);
    outline-offset: 2px;
    border-radius: 3px;
  }

  code {
    font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .88em;
    background: var(--surface-sunk);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 1px 5px;
  }

  pre {
    font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13.5px;
    line-height: 1.7;
    background: var(--surface-sunk);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 16px 18px;
    overflow-x: auto;
    margin: 0 0 18px;
  }
  pre code { background: none; border: 0; padding: 0; font-size: inherit; }
  pre .c { color: var(--ink-faint); }

  ul { margin: 0 0 16px; padding-left: 20px; }
  li { margin-bottom: 7px; }
  li::marker { color: var(--accent); }

  /* ---------- screenshots ---------- */

  .shot { margin: 24px 0 8px; }

  .shot__frame {
    position: relative;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .shot img { display: block; width: 100%; height: auto; }

  .shot--tall .shot__frame { max-height: 460px; }
  .shot--tall .shot__frame::after {
    content: "";
    position: absolute;
    inset: auto 0 0 0;
    height: 90px;
    background: linear-gradient(to bottom, transparent, var(--surface));
    pointer-events: none;
  }
  .shot--tall .shot__frame.is-open { max-height: none; }
  .shot--tall .shot__frame.is-open::after { display: none; }

  .shot__expand {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 2;
    font: 600 12.5px/1 "IBM Plex Sans", sans-serif;
    color: var(--surface);
    background: var(--ink);
    border: 0;
    border-radius: 999px;
    padding: 8px 14px;
    cursor: pointer;
  }
  .shot__expand:hover { background: var(--accent); }
  .shot:not(.shot--tall) .shot__expand { display: none; }

  figcaption {
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--ink-faint);
    padding-top: 10px;
  }

  .shot--phone { max-width: 300px; }
  .shot--phone .shot__frame { max-height: 520px; }

  .pair {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    align-items: start;
  }
  @media (min-width: 860px) {
    .pair { grid-template-columns: 1fr 300px; }
  }

  /* ---------- callout ---------- */

  .note {
    border-left: 3px solid var(--warn);
    background: var(--warn-wash);
    color: var(--ink);
    padding: 14px 18px;
    border-radius: 0 8px 8px 0;
    margin: 0 0 20px;
    font-size: 15.5px;
  }
  .note strong { color: var(--warn); }

  .checklist { list-style: none; padding: 0; }
  .checklist li {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 10px;
    align-items: start;
    margin-bottom: 12px;
    font-size: 15.5px;
  }
  .checklist .mark { font-weight: 700; line-height: 1.5; }
  .checklist .mark--todo { color: var(--stop); }
  .checklist .mark--done { color: var(--ok); }

  footer {
    border-top: 1px solid var(--line);
    padding-top: 24px;
    font-size: 13.5px;
    color: var(--ink-faint);
  }

  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
</style>

<div class="wrap">

  <header class="masthead">
    <div class="col">
      <p class="eyebrow">Washington adult family homes &middot; chapter 388-76 WAC</p>
      <h1>AFH&nbsp;Compliance, running</h1>
      <p class="standfirst">
        Every screen below is the actual application, driven by a browser against a seeded
        demo home. It is not a mockup. What it is not yet is deployed &mdash; here is why,
        and what it takes.
      </p>
    </div>
  </header>

  <div class="status" role="table" aria-label="Deployment status">
    <div class="status__row" role="row">
      <div class="status__key" role="cell">Live URL</div>
      <p class="status__val" role="cell">
        <span class="pill pill--stop"><span class="pill__dot"></span>Not deployed</span><br />
        The sandbox this was built in has no route to a hosting provider &mdash;
        <code>api.vercel.com</code>, <code>api.netlify.com</code> and
        <code>api.cloudflare.com</code> are all refused by its egress proxy, and it has no
        tunnelling client. It also holds no credentials of yours to deploy under.
      </p>
    </div>
    <div class="status__row" role="row">
      <div class="status__key" role="cell">Code</div>
      <p class="status__val" role="cell">
        <span class="pill pill--ok"><span class="pill__dot"></span>Pushed</span>
        &nbsp;<code>claude/family-home-compliance-platform-03o7q0</code>, in
        <code>afh-platform/</code>.
      </p>
    </div>
    <div class="status__row" role="row">
      <div class="status__key" role="cell">Verified</div>
      <p class="status__val" role="cell">
        <span class="pill pill--ok"><span class="pill__dot"></span>45/45</span>
        &nbsp;browser assertions across all six areas, plus type-check and production build.
      </p>
    </div>
    <div class="status__row" role="row">
      <div class="status__key" role="cell">Blocking</div>
      <p class="status__val" role="cell">
        <span class="pill pill--warn"><span class="pill__dot"></span>Two changes</span>
        &nbsp;SQLite and local-disk uploads both need replacing before this survives on a
        serverless host. <a href="#deploy">Details below.</a>
      </p>
    </div>
  </div>

  <section id="gaps">
    <div class="col">
      <h2>What a licensor would write up today</h2>
      <p class="lede">
        The dashboard opens on the only question that matters the morning of an inspection.
        The demo home scores 65&percnt;: twenty-five findings a surveyor could write up now,
        four more lapsing shortly.
      </p>
      <p>
        Each finding carries the record that is missing, who it is missing for, the rule
        behind it, and the specific next action. The right-hand rail takes recent rule
        changes and runs them against this home&rsquo;s own records rather than announcing
        them.
      </p>
    </div>
    ${figure(img.dashboard, "Dashboard. Readiness score, findings ordered worst-first, and rule changes evaluated against this home.")}
  </section>

  <section id="applicability">
    <div class="col">
      <h2>Only the rules that apply to you</h2>
      <p class="lede">
        This is the part that decides whether the product is usable or just noisy. Every
        check declares when it applies &mdash; to the home, and to the individual.
      </p>
      <p>
        A home with no staff is never asked for employee files. A resident who
        self-administers medication is asked for a self-administration assessment and
        <em>not</em> for a medication administration record. A home without a dementia
        designation never sees dementia training requirements at all. The dashboard reports
        how many checks it skipped as inapplicable.
      </p>
      <p>
        Deadline rules are measured against the earliest document on file, not the newest,
        and stop applying once a full review cycle has passed. Without that, this year&rsquo;s
        annual review of a five-year resident reads as hundreds of days late.
      </p>
    </div>
    ${figure(img.resident, "A resident admitted twelve days ago — the admission-deadline requirements are still live for him.")}
  </section>

  <section id="vault">
    <div class="col">
      <h2>The vault, and the binder it prints</h2>
      <p class="lede">
        Resident, employee and home records, each filed against the requirement that calls
        for it. A phone photo of a paper record is a first-class citizen.
      </p>
      <p>
        Expiry is either recorded directly or derived from the issue date plus the document
        type&rsquo;s renewal interval, so a lapsed TB test surfaces weeks early rather than
        during a visit. The binder prints a cover sheet and a tab per resident and per
        employee, with page breaks where a physical binder needs them.
      </p>
    </div>
    ${figure(img.vault, "Document vault, filterable by whether a record belongs to the home, a resident, or an employee.")}
    ${figure(img.binder, "The printable inspection binder — cover sheet, outstanding items, then a tab per person.")}
  </section>

  <section id="forms">
    <div class="col">
      <h2>Forms that generate, sign, and file themselves</h2>
      <p class="lede">
        A template is a field schema plus a body with tokens. Filling it produces a printable
        document; signing it files a copy into the vault, where it starts counting toward
        compliance.
      </p>
      <p>
        Staff sign on screen. Family members and legal representatives get a single-use link
        that expires in twenty-one days and needs no account. When the last required signer
        is in, the rendered document is snapshotted &mdash; so a later edit to the template
        can never rewrite what somebody actually signed.
      </p>
    </div>
    ${figure(img["form-signed"], "A negotiated care plan signed by the provider, with the family member's signing link still outstanding.")}
    <div class="pair">
      <div>
        ${figure(img.forms, "Seven starter templates, each tied to the document type it files as.")}
      </div>
      <figure class="shot shot--phone shot--tall">
        <div class="shot__frame">
          <img src="${img["phone-signing"]}" alt="The same care plan on a family member's phone, with the signature panel below it." loading="lazy" />
          <button class="shot__expand" type="button">Expand</button>
        </div>
        <figcaption>The same document on the family member&rsquo;s phone. No account, no app.</figcaption>
      </figure>
    </div>
  </section>

  <section id="citations">
    <div class="col">
      <h2>What other homes were cited for</h2>
      <p class="lede">
        Providers post the deficiencies they received so others can avoid them. Anonymity is
        the entire product here, so it is engineered rather than promised.
      </p>
      <ul>
        <li>The author is stored as a salted one-way digest, never a foreign key.</li>
        <li>The salt lives outside the database, so a database leak alone deanonymises nobody &mdash; and rotating it permanently detaches every post from its author.</li>
        <li>Location is county-level; dates are quarter-level.</li>
        <li>Phone numbers, emails, addresses and licence numbers are stripped <em>before storage</em>, and the author is shown exactly what was removed rather than having their account of an inspection silently edited.</li>
        <li>Every post is held for moderation before it appears.</li>
      </ul>
      <p>
        Each post links to its rule, and any signed-in provider can run that same rule
        against their own records in one click.
      </p>
    </div>
    ${figure(img["citation-selfcheck"], "A citation post after scrubbing, with the redactions disclosed — and the same rule run against the reader's own home.")}
    ${figure(img["citation-board"], "The board, filterable by county, severity, home size and rule.")}
  </section>

  <section id="updates">
    <div class="col">
      <h2>A rule change, answered</h2>
      <p class="lede">
        A regulatory update lists the checks it touches. The feed, the dashboard and the
        email digest all run those checks against the reader&rsquo;s own home.
      </p>
      <p>
        So a change arrives as <em>&ldquo;two gaps at your home &mdash; Ana R. missing,
        David P. missing&rdquo;</em> rather than <em>&ldquo;a rule changed&rdquo;</em>. That
        difference is the reason to subscribe.
      </p>
    </div>
    ${figure(img.updates, "The rule-update feed, each entry checked against this home's records.")}
  </section>

  <section id="honesty">
    <div class="col">
      <h2>The rule catalog is a scaffold</h2>
      <div class="note">
        <strong>Read this before anyone uses it for a real survey.</strong> The subchapter
        structure comes from the published organisation of chapter 388-76 WAC, but the
        individual section titles are descriptive labels written for this catalog, and no
        rule text has been verified. The sandbox had no route to
        <code>app.leg.wa.gov</code> or any mirror.
      </div>
      <p>
        Rather than let that pass silently, every seeded entry is stored unverified and
        badged as such everywhere its citation appears. A single command replaces the whole
        catalog once you have a checked one:
      </p>
      <pre><code>npm run wac:import -- ./wac-388-76.json</code></pre>
      <p>
        The same caveat applies to the document types, rule checks and form templates: they
        encode what adult family homes commonly keep, not verified legal requirements. Where
        the state publishes an official form, use the official one.
      </p>
    </div>
    ${figure(img.catalog, "The catalog is explicit about its own reliability rather than quietly presenting itself as law.")}
  </section>

  <section id="deploy">
    <div class="col">
      <h2>Getting a real URL</h2>
      <p class="lede">
        Two things genuinely block a serverless deploy. Neither is difficult, but neither is
        a checkbox &mdash; a straight push to Vercel today would appear to work and then lose
        data.
      </p>

      <ul class="checklist">
        <li><span class="mark mark--todo">1</span><span><strong>SQLite &rarr; Postgres.</strong> A serverless filesystem is ephemeral, so the database file would reset on every cold start. One line in <code>prisma/schema.prisma</code> plus a connection string; the schema itself was written to survive the move, with no enum or array columns.</span></li>
        <li><span class="mark mark--todo">2</span><span><strong>Local disk &rarr; object storage.</strong> Uploaded documents are written to <code>./storage</code>. Four functions in <code>src/lib/storage.ts</code> need reimplementing against Vercel Blob or S3 &mdash; nothing else in the codebase touches the filesystem.</span></li>
        <li><span class="mark mark--done">3</span><span><strong>Everything else is ready.</strong> Secrets are read from the environment, sessions need no external store, and the build is clean.</span></li>
      </ul>

      <h3>Once those two are done</h3>
      <pre><code><span class="c"># from afh-platform/</span>
npx vercel link
npx vercel env add DATABASE_URL      <span class="c"># your Postgres URL</span>
npx vercel env add SESSION_SECRET    <span class="c"># openssl rand -hex 32</span>
npx vercel env add ANON_SALT         <span class="c"># openssl rand -hex 32</span>
npx vercel env add APP_URL           <span class="c"># https://your-domain</span>

npx prisma db push
SEED_DEMO=false npx tsx prisma/seed.ts   <span class="c"># catalog only, no demo home</span>

npx vercel --prod</code></pre>

      <div class="note">
        <strong>Before real resident data goes in.</strong> These records are protected
        health information. Uploads are currently unencrypted at rest and there is no audit
        log of who read which record. Encryption, a BAA with the host, access logging and a
        retention policy all belong in front of the first real resident, not after.
      </div>

      <h3>Run it locally right now</h3>
      <pre><code>git checkout claude/family-home-compliance-platform-03o7q0
cd afh-platform
cp .env.example .env
npm install
npm run setup
npm run dev        <span class="c"># http://localhost:3000</span></code></pre>
      <p>
        Sign in as <code>demo@example.com</code> / <code>demo-password-123</code>. That
        account is seeded as an administrator, so the moderation queue and the digest runner
        are reachable too.
      </p>
    </div>
  </section>

  <footer>
    <div class="col">
      Screens captured from the application running against its seeded demo home. No mail
      transport is configured in this build, so signing links and subscription confirmations
      queue to an in-app outbox rather than being silently dropped.
    </div>
  </footer>

</div>

<script>
  // Tall captures are clipped by default; let the reader open any of them.
  for (const button of document.querySelectorAll(".shot__expand")) {
    button.addEventListener("click", () => {
      const frame = button.closest(".shot__frame");
      const open = frame.classList.toggle("is-open");
      button.textContent = open ? "Collapse" : "Expand";
    });
  }
</script>
`;

await writeFile("walkthrough.html", html);
const { size } = await stat("walkthrough.html");
console.log(`walkthrough.html  ${(size / 1024 / 1024).toFixed(2)} MB`);
