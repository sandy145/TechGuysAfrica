# Ghana.gov Assistant (test build)

A test prototype of an **AI-powered front door to Government of Ghana
services**, modelled on the America.gov approach: one search box, no account,
plain-language answers that cite the agency responsible.

```bash
cd ghana-gov-ai
npm install
cp .env.example .env    # optional: add ANTHROPIC_API_KEY for AI answers
npm run dev             # http://localhost:3000
```

Without an API key the site runs in **offline demo mode**: retrieval and
citations still work, but answers are assembled from the knowledge base rather
than written by the model.

## What's in it

| Page | What it does |
| --- | --- |
| `/` | Hero ask box, suggested questions, popular services, topics, ministries |
| `/ask` | Streaming chat with inline `[n]` citations and source cards, follow-up questions |
| `/services`, `/services/[slug]` | Browsable service pages generated from the same knowledge base |
| `POST /api/chat` | Retrieves matching services, then streams an answer as NDJSON (`sources`, `text`, `done`/`error` events) |

How an answer is produced:

1. `src/lib/retrieve.ts` scores the question (plus the previous question, for
   follow-ups) against `src/lib/services.ts` and picks the top matches.
2. Those entries are passed to Claude (`claude-opus-5-5`, low effort, server-side
   refusal fallback) as numbered sources, with a system prompt that limits
   answers to those sources, forbids quoting fees as fact, never asks for ID
   numbers or PINs, and answers in the user's language (English, Twi, Ga, Ewe,
   Dagbani, Hausa, French).
3. The browser renders the stream and links each `[n]` to its source card.

## Read this first

**The knowledge base is a scaffold, not authoritative.** The 22 entries in
`src/lib/services.ts` were written for this test from general knowledge of how
each service works; they were not copied from or checked against agency
websites (ghana.gov.gh was not reachable from the build environment). Fees are
deliberately omitted. Agency URLs, ministry names and steps all need review by
the owning agencies before anything like this is shown to the public.

The site carries a "Test prototype, not an official Government of Ghana
website" banner on every page and is set to `noindex`. Keep both while it's a
test.

## Next steps toward a real service

- Replace the hand-written entries with content synced from agency pages, and
  swap keyword retrieval for embeddings once the corpus is large.
- Add an evaluation set of real citizen questions per language.
- Add rate limiting and abuse protection on `/api/chat` before public exposure.
- Phase two (as with America.gov): authenticated, agency-integrated actions
  such as booking appointments or submitting documents.

## Checks

```bash
npm run typecheck
npm run build && npm start   # in one terminal
npm run smoke                # in another (BASE_URL defaults to http://localhost:3000)
```
