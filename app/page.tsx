"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AnswerCard } from "@/app/components/AnswerCard";
import { AnswerMetaPanels } from "@/app/components/AnswerMetaPanels";
import { ExampleQuestions } from "@/app/components/ExampleQuestions";
import { HeroSection } from "@/app/components/HeroSection";
import { LegalDisclaimer } from "@/app/components/LegalDisclaimer";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { TechnologyStats } from "@/app/components/TechnologyStats";
import { extractCitations } from "@/app/lib/citationExtractor";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);

  const citations = useMemo(() => extractCitations(answer), [answer]);

  async function ask(query: string) {
    if (!query.trim() || loading) return;

    setQuestion(query);
    setLoading(true);
    setError("");
    setAnswer("");
    setResponseTimeMs(null);

    const startedAt = performance.now();

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

      setResponseTimeMs(performance.now() - startedAt);
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

      <main id="ask" className="w-full bg-ivory-50 px-6 py-16 sm:py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <section
            aria-labelledby="ask-heading"
            className="animate-fade-in-up flex flex-col gap-5 rounded-3xl border border-navy-900/10 bg-white p-6 shadow-md shadow-navy-900/5 sm:p-10"
          >
            <div className="text-center sm:text-left">
              <h2 id="ask-heading" className="font-serif text-2xl font-semibold text-navy-900 sm:text-3xl">
                Ask a legal question
              </h2>
              <p className="mt-1.5 text-navy-700/70">
                Answers are grounded in retrieved statute text where available.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label htmlFor="question" className="sr-only">
                Your legal question
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. 개인정보 보호법 제29조의 안전조치의무는 무엇인가?"
                rows={3}
                disabled={loading}
                className="w-full resize-none rounded-2xl border border-navy-900/15 bg-mist-50 px-5 py-4 text-base text-navy-900 outline-none transition-colors placeholder:text-navy-700/40 focus:border-gold-600/60 focus:bg-white focus:ring-2 focus:ring-gold-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  aria-busy={loading}
                  className="inline-flex items-center gap-2 self-start rounded-full bg-navy-800 px-7 py-3.5 text-sm font-semibold text-ivory-50 shadow-md shadow-navy-900/20 transition-all outline-none hover:-translate-y-0.5 hover:bg-navy-700 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-gold-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
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
                    "Ask Public Law AI"
                  )}
                </button>
              </div>
            </form>

            <ExampleQuestions onSelect={(q) => void ask(q)} disabled={loading} />
          </section>

          {error && (
            <div
              role="alert"
              className="animate-fade-in-up flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
            >
              <svg
                viewBox="0 0 20 20"
                className="mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7.25" />
                <path d="M10 6.75v4M10 13.25h.01" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <AnswerCard loading={loading} answer={answer} />
          <AnswerMetaPanels citations={citations} responseTimeMs={responseTimeMs} hasAnswer={Boolean(answer || loading)} />

          <LegalDisclaimer />
        </div>
      </main>

      <TechnologyStats />
      <SiteFooter />
    </div>
  );
}
