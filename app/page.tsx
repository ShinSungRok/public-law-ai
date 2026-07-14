"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AnswerCard } from "@/app/components/AnswerCard";
import { ExampleQuestions } from "@/app/components/ExampleQuestions";
import { HeroSection } from "@/app/components/HeroSection";
import { LegalDisclaimer } from "@/app/components/LegalDisclaimer";
import { SiteHeader } from "@/app/components/SiteHeader";
import { extractCitations } from "@/app/lib/citationExtractor";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const citations = useMemo(() => extractCitations(answer), [answer]);

  async function ask(query: string) {
    if (!query.trim() || loading) return;

    setQuestion(query);
    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <HeroSection />

      <main id="ask" className="flex w-full flex-1 justify-center px-6 py-12 sm:py-16">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <section
            aria-labelledby="ask-heading"
            className="flex flex-col gap-4 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm shadow-navy-900/5 sm:p-6"
          >
            <div>
              <h2 id="ask-heading" className="font-serif text-lg font-semibold text-navy-900">
                Ask a legal question
              </h2>
              <p className="mt-1 text-sm text-navy-700/70">
                Answers are grounded in retrieved statute text where available.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label htmlFor="question" className="sr-only">
                Your legal question
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. 개인정보 보호법 제29조의 안전조치의무는 무엇인가?"
                rows={3}
                className="w-full resize-none rounded-xl border border-navy-900/15 bg-mist-50 px-4 py-3 text-sm text-navy-900 outline-none placeholder:text-navy-700/40 focus:border-gold-600/60 focus:bg-white focus:ring-2 focus:ring-gold-500/20"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="inline-flex items-center gap-2 self-start rounded-full bg-navy-800 px-5 py-2.5 text-sm font-medium text-ivory-50 shadow-sm transition-colors hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ivory-50/40 border-t-ivory-50"
                      />
                      Consulting…
                    </>
                  ) : (
                    "Ask the professor"
                  )}
                </button>
              </div>
            </form>

            <ExampleQuestions onSelect={(q) => void ask(q)} disabled={loading} />
          </section>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <AnswerCard loading={loading} answer={answer} citations={citations} />

          <LegalDisclaimer />
        </div>
      </main>

      <footer className="border-t border-navy-900/10 bg-ivory-50 px-6 py-6 text-center text-xs text-navy-700/60">
        Public Law AI — retrieval-augmented legal Q&amp;A, built as a portfolio
        project.
      </footer>
    </div>
  );
}
