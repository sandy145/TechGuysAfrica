import Anthropic from "@anthropic-ai/sdk";
import { retrieve, renderSource } from "@/lib/retrieve";
import type { Service } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 12;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `You are the Ghana.gov Assistant, a test prototype of an AI front door to Government of Ghana services.

How to answer:
- Answer only from the numbered SOURCES supplied with the question. Cite them inline like [1] or [2] after the sentence they support.
- If the sources do not cover the question, say you don't have verified information on it yet and point the person to the most relevant agency, or to ghana.gov.gh. Do not fill gaps from memory.
- Never state fees, deadlines or processing times as fact. Tell people to confirm current amounts on the agency's official site.
- Be practical: lead with what to do, then a short numbered list of steps and what to bring.
- Keep it short and plain. No headings. Use the language the person writes in (English, Twi, Ga, Ewe, Dagbani, Hausa or French); if unsure, use English.
- Never ask for or repeat a Ghana Card PIN, passport number, phone number, Mobile Money PIN or password. Remind people that government staff never ask for a Mobile Money PIN.
- If someone describes an emergency, tell them to call 112 first.
- You cannot submit applications, make payments or look up personal records. Say so if asked.`;

type ChatTurn = { role: "user" | "assistant"; content: string };

type SourceCard = { n: number; title: string; agency: string; url: string; slug: string };

function toCard(svc: Service, i: number): SourceCard {
  return { n: i + 1, title: svc.title, agency: svc.agency, url: svc.agencyUrl, slug: svc.slug };
}

function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function parseBody(raw: unknown): ChatTurn[] | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { messages?: unknown }).messages)) return null;
  const turns: ChatTurn[] = [];
  for (const m of (raw as { messages: unknown[] }).messages) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    turns.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  const recent = turns.slice(-MAX_TURNS);
  // The API needs the conversation to open with a user turn.
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (!recent.length || recent[recent.length - 1].role !== "user") return null;
  return recent;
}

// Offline demo: no model call, answer assembled from the best match.
function offlineAnswer(sources: Service[]): string {
  if (!sources.length) {
    return "I don't have verified information on that yet. Try rephrasing, browse the services list, or visit ghana.gov.gh.\n\n(Offline demo mode: set ANTHROPIC_API_KEY for full AI answers.)";
  }
  const top = sources[0];
  const steps = top.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const docs = top.documents?.length ? `\n\nWhat to bring:\n${top.documents.map((d) => `- ${d}`).join("\n")}` : "";
  const more = sources.length > 1 ? `\n\nRelated: ${sources.slice(1).map((s, i) => `${s.title} [${i + 2}]`).join(", ")}.` : "";
  return `${top.summary} [1]\n\n${steps}${docs}\n\nConfirm current fees and requirements with ${top.agency} before you go. [1]${more}\n\n(Offline demo mode: set ANTHROPIC_API_KEY for full AI answers.)`;
}

export async function POST(req: Request) {
  let turns: ChatTurn[] | null;
  try {
    turns = parseBody(await req.json());
  } catch {
    turns = null;
  }
  if (!turns) return Response.json({ error: "Expected { messages: [{ role, content }] } ending with a user turn." }, { status: 400 });

  const question = turns[turns.length - 1].content;
  // Fold in the previous user turn so follow-ups like "what do I bring?" still find the service.
  const prevUser = turns.slice(0, -1).reverse().find((t) => t.role === "user")?.content ?? "";
  let sources = retrieve(question);
  if (sources.length < 2 && prevUser) {
    const extra = retrieve(`${prevUser} ${question}`).filter((s) => !sources.includes(s));
    sources = [...sources, ...extra].slice(0, 4);
  }
  const cards = sources.map(toCard);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      send({ type: "sources", sources: cards, mode: hasCredentials() ? "ai" : "offline" });

      if (!hasCredentials()) {
        send({ type: "text", text: offlineAnswer(sources) });
        send({ type: "done" });
        controller.close();
        return;
      }

      const sourceBlock = sources.length
        ? sources.map((s, i) => renderSource(s, i + 1)).join("\n\n")
        : "(No matching sources found.)";
      const messages: Anthropic.Beta.BetaMessageParam[] = turns!.map((t, i) =>
        i === turns!.length - 1
          ? { role: "user", content: `SOURCES:\n${sourceBlock}\n\nQUESTION:\n${t.content}` }
          : { role: t.role, content: t.content },
      );

      try {
        const client = new Anthropic();
        const response = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          output_config: { effort: "low" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          messages,
        });
        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "text", text: event.delta.text });
          }
        }
        const final = await response.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ type: "text", text: "\n\nI can't help with that here. Please contact the relevant agency directly." });
        }
        send({ type: "done" });
      } catch (err) {
        const message =
          err instanceof Anthropic.RateLimitError
            ? "The assistant is busy right now. Please try again in a moment."
            : err instanceof Anthropic.AuthenticationError
              ? "The assistant is not configured correctly (authentication failed)."
              : err instanceof Anthropic.APIError
                ? "The assistant could not answer right now. Please try again."
                : "Something went wrong. Please try again.";
        console.error("chat error", err);
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
