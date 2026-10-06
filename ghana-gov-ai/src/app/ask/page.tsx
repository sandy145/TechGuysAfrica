import { Chat } from "@/components/Chat";

export const metadata = { title: "Ask | Ghana.gov Assistant (test build)" };

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Ask Ghana.gov</h1>
      <Chat key={q ?? ""} initialQuestion={q?.slice(0, 2000)} />
    </div>
  );
}
