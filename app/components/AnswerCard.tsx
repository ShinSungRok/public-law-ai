import { useMemo } from "react";
import { splitAnswerByCitations } from "@/app/lib/citationExtractor";

interface AnswerCardProps {
  loading: boolean;
  answer: string;
}

export function AnswerCard({ loading, answer }: AnswerCardProps) {
  const segments = useMemo(() => splitAnswerByCitations(answer), [answer]);

  if (!loading && !answer) {
    return null;
  }

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-navy-900/10 border-l-[6px] border-l-gold-600 bg-white shadow-sm shadow-navy-900/5">
      <div className="px-6 py-6 sm:px-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-navy-700 uppercase">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-800 text-[10px] font-bold text-gold-400"
          >
            AI
          </span>
          Grounded Answer
        </div>

        {loading && !answer ? (
          <div role="status" aria-live="polite" className="flex max-w-3xl flex-col gap-2.5">
            <span className="sr-only">Consulting retrieved statutes…</span>
            <div aria-hidden="true" className="h-3.5 w-11/12 animate-pulse rounded bg-mist-200" />
            <div aria-hidden="true" className="h-3.5 w-4/5 animate-pulse rounded bg-mist-200" />
            <div aria-hidden="true" className="h-3.5 w-3/5 animate-pulse rounded bg-mist-200" />
            <p aria-hidden="true" className="mt-1 text-sm text-navy-700/60">
              Consulting retrieved statutes…
            </p>
          </div>
        ) : (
          <div
            aria-live="polite"
            className="max-w-3xl text-[15px] leading-relaxed whitespace-pre-wrap text-navy-900"
          >
            {segments.map((segment, index) =>
              segment.isCitation ? (
                <span
                  key={index}
                  className="rounded bg-gold-500/15 px-1 py-0.5 font-medium text-navy-900"
                >
                  {segment.text}
                </span>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
            {loading && (
              <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse text-gold-600">
                ▍
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
