"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { SUGGESTIONS } from "@/lib/suggestions";

type Source = { n: number; title: string; agency: string; url: string; slug: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  mode?: "ai" | "offline";
  error?: string;
  pending?: boolean;
};

// Turns "[2]" into a link to the matching source card.
function withCitations(text: string, sources: Source[] | undefined, keyPrefix: string) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
    const src = sources?.find((s) => s.n === Number(m[1]));
    if (!src) return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
    return (
      <a
        key={`${keyPrefix}-${i}`}
        href={`#src-${keyPrefix.split("-")[0]}-${src.n}`}
        title={src.title}
        className="mx-0.5 inline-grid h-5 min-w-5 place-items-center rounded bg-forest-50 px-1 align-text-top text-[11px] font-semibold text-forest-700 no-underline hover:bg-forest-100"
      >
        {src.n}
      </a>
    );
  });
}

function Answer({ text, sources, id }: { text: string; sources?: Source[]; id: number }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="prose-answer leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter(Boolean);
        const ordered = lines.length > 0 && lines.every((l) => /^\s*\d+[.)]\s/.test(l));
        const bulleted = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s/.test(l));
        const key = `${id}-${bi}`;
        if (ordered || bulleted) {
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag key={key} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
              {lines.map((l, li) => (
                <li key={li}>{withCitations(l.replace(/^\s*(\d+[.)]|[-*•])\s/, "").replace(/\*\*/g, ""), sources, `${key}-${li}`)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={key} className="whitespace-pre-line">
            {withCitations(block.replace(/\*\*/g, ""), sources, key)}
          </p>
        );
      })}
    </div>
  );
}

export function Chat({ initialQuestion }: { initialQuestion?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;
      setBusy(true);
      setInput("");
      const history: Message[] = [...messages, { role: "user", content: text }];
      setMessages([...history, { role: "assistant", content: "", pending: true }]);

      const update = (patch: (m: Message) => Message) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = patch(next[next.length - 1]);
          return next;
        });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
          }),
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const evt = JSON.parse(line);
            if (evt.type === "sources") update((m) => ({ ...m, sources: evt.sources, mode: evt.mode }));
            else if (evt.type === "text") update((m) => ({ ...m, content: m.content + evt.text }));
            else if (evt.type === "error") update((m) => ({ ...m, error: evt.error }));
          }
        }
      } catch (err) {
        update((m) => ({ ...m, error: err instanceof Error ? err.message : "Something went wrong." }));
      } finally {
        update((m) => ({ ...m, pending: false }));
        setBusy(false);
      }
    },
    [busy, messages],
  );

  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, ask]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-forest-50/60 p-6">
          <p className="text-lg font-semibold">Akwaaba. What do you need help with?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Ask in English, Twi, Ga, Ewe, Dagbani, Hausa or French. Answers cite the agency responsible.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-forest-700/20 bg-white px-3 py-1.5 text-sm hover:border-forest-700"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-forest-700 px-4 py-2.5 text-white">
            {m.content}
          </div>
        ) : (
          <div key={i} className="max-w-full rounded-2xl rounded-bl-sm border border-gray-200 bg-white p-4 shadow-sm sm:max-w-[90%]">
            {m.pending && !m.content ? (
              <p className="animate-pulse text-ink-soft">Searching official sources…</p>
            ) : (
              <Answer text={m.content} sources={m.sources} id={i} />
            )}
            {m.error && <p className="mt-2 text-sm text-flag-red">{m.error}</p>}
            {!!m.sources?.length && !m.pending && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Sources</p>
                <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                  {m.sources.map((s) => (
                    <li key={s.n} id={`src-${i}-${s.n}`} className="rounded-lg border border-gray-200 p-2.5 text-sm">
                      <span className="mr-1.5 font-semibold text-forest-700">{s.n}</span>
                      <Link href={`/services/${s.slug}`} className="font-medium hover:underline">
                        {s.title}
                      </Link>
                      <a href={s.url} target="_blank" rel="noreferrer" className="block text-xs text-ink-soft hover:underline">
                        {s.agency} ↗
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {!m.pending && m.mode === "offline" && (
              <p className="mt-3 text-xs text-ink-soft">Offline demo mode, no AI model connected.</p>
            )}
          </div>
        ),
      )}
      <div ref={bottomRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-4 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/10"
      >
        <label htmlFor="ask-chat" className="sr-only">Your question</label>
        <input
          id="ask-chat"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={messages.length ? "Ask a follow-up…" : "Ask about any government service…"}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none placeholder:text-gray-400"
          disabled={busy}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-xl bg-forest-700 px-5 py-2.5 font-medium text-white hover:bg-forest-800 disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
      <p className="-mt-3 text-center text-xs text-ink-soft">
        AI can make mistakes. Check important details with the agency. Don&apos;t share ID numbers or PINs.
      </p>
    </div>
  );
}
