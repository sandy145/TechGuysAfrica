// Smoke test against a running server: `npm start` then `npm run smoke`.
// Works in offline demo mode (no ANTHROPIC_API_KEY) or AI mode.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failed++;
};

async function chat(messages) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) return { status: res.status, events: [] };
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
  return { status: res.status, events };
}

for (const path of ["/", "/ask", "/services", "/services/ghana-card"]) {
  const res = await fetch(BASE + path);
  check(`GET ${path}`, res.status === 200, String(res.status));
}
check("GET unknown service 404s", (await fetch(`${BASE}/services/nope`)).status === 404);

const cases = [
  ["How do I renew my passport?", "passport"],
  ["How do I get a Ghana Card?", "ghana-card"],
  ["I want to register my company", "register-business"],
  ["How do I renew NHIS?", "nhis"],
  ["there's been an accident, who do I call", "emergency"],
];
for (const [q, slug] of cases) {
  const { events } = await chat([{ role: "user", content: q }]);
  const top = events.find((e) => e.type === "sources")?.sources?.[0]?.slug;
  check(`retrieves ${slug} for "${q}"`, top === slug, `got ${top}`);
  check(`answers "${q}"`, events.some((e) => e.type === "text") && events.at(-1)?.type === "done");
}

const followUp = await chat([
  { role: "user", content: "How do I get a Ghana Card?" },
  { role: "assistant", content: "..." },
  { role: "user", content: "what documents should I bring?" },
]);
check("follow-up keeps context", followUp.events[0]?.sources?.[0]?.slug === "ghana-card");

check("rejects bad body", (await chat("nope")).status === 400);
check("rejects trailing assistant turn", (await chat([{ role: "assistant", content: "hi" }])).status === 400);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
