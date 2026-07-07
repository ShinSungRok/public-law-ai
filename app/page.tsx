"use client";

import { useState, type FormEvent } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Legal Q&A (Prototype)
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Ask a general legal question. This is an early prototype.
          </p>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Not legal advice.</strong> This answer is generated
          directly by an AI model from its general training data. It is{" "}
          <strong>not</strong> based on retrieved statutes, case law, or any
          verified legal source, and may be inaccurate or out of date. Always
          verify with a licensed attorney or primary source.
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is the statute of limitations for a contract dispute?"
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="self-start rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {(answer || loading) && (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50">
            {answer}
            {loading && <span className="animate-pulse">▍</span>}
          </div>
        )}
      </main>
    </div>
  );
}
