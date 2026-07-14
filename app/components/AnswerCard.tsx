import { CitationList } from "./CitationList";

interface AnswerCardProps {
  loading: boolean;
  answer: string;
  citations: string[];
}

export function AnswerCard({ loading, answer, citations }: AnswerCardProps) {
  if (!loading && !answer) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-900/10 border-l-[6px] border-l-gold-600 bg-white shadow-sm shadow-navy-900/5">
      <div className="px-5 py-5 sm:px-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-navy-700 uppercase">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-800 text-[10px] font-bold text-gold-400"
          >
            AI
          </span>
          Answer
        </div>

        {loading && !answer ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-2.5">
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
            className="text-[15px] leading-relaxed whitespace-pre-wrap text-navy-900"
          >
            {answer}
            {loading && (
              <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse text-gold-600">
                ▍
              </span>
            )}
          </div>
        )}
      </div>

      <CitationList citations={citations} />
    </div>
  );
}
