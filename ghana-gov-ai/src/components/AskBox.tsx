"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AskBox({ placeholder = "Ask about any government service…" }: { placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = q.trim();
        if (text) router.push(`/ask?q=${encodeURIComponent(text)}`);
      }}
      className="flex w-full items-center gap-2 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/5"
    >
      <label htmlFor="ask-home" className="sr-only">Ask a question</label>
      <input
        id="ask-home"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-ink outline-none placeholder:text-gray-400"
      />
      <button type="submit" className="shrink-0 rounded-xl bg-forest-700 px-5 py-3 font-medium text-white hover:bg-forest-800">
        Ask
      </button>
    </form>
  );
}
