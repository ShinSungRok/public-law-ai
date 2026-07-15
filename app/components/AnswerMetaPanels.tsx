import { MetaCard } from "./MetaCard";

const DocumentIcon = (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M5 3.5h7l3 3V16a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 16V4a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
    <path d="M12 3.5V6.5a.5.5 0 0 0 .5.5H15.5M7 9.5h6M7 12.5h6" strokeLinecap="round" />
  </svg>
);

const StackIcon = (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M10 2.5 17.5 6.5 10 10.5 2.5 6.5 10 2.5Z" strokeLinejoin="round" />
    <path d="M2.5 10.5 10 14.5l7.5-4M2.5 14.5 10 18.5l7.5-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GaugeIcon = (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M3 14a7 7 0 0 1 14 0" strokeLinecap="round" />
    <path d="M10 14 13 9" strokeLinecap="round" />
    <circle cx="10" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

const ClockIcon = (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface AnswerMetaPanelsProps {
  citations: string[];
  responseTimeMs: number | null;
  hasAnswer: boolean;
}

export function AnswerMetaPanels({ citations, responseTimeMs, hasAnswer }: AnswerMetaPanelsProps) {
  if (!hasAnswer) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetaCard title="Referenced Articles" icon={DocumentIcon}>
        {citations.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {citations.map((citation) => (
              <li
                key={citation}
                className="rounded-md border border-gold-600/30 bg-gold-500/10 px-2 py-1 text-xs font-medium text-navy-800"
              >
                <span aria-hidden="true" className="mr-1 text-gold-600">
                  §
                </span>
                {citation}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-navy-700/50">No specific article detected in this answer.</p>
        )}
      </MetaCard>

      <MetaCard title="Retrieved Documents" icon={StackIcon} comingSoon>
        <p className="text-xs text-navy-700/50">
          A full view of every retrieved statute passage behind this answer is
          planned for a future release.
        </p>
      </MetaCard>

      <MetaCard title="Answer Confidence" icon={GaugeIcon} comingSoon>
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className="h-1.5 flex-1 rounded-full bg-mist-200 bg-[repeating-linear-gradient(135deg,#c9ccd2_0,#c9ccd2_4px,transparent_4px,transparent_8px)]"
          />
          <span className="text-xs font-medium text-navy-700/40">Not yet available</span>
        </div>
      </MetaCard>

      <MetaCard title="Response Time" icon={ClockIcon}>
        <p className="font-serif text-lg font-semibold text-navy-900">
          {responseTimeMs !== null ? `${(responseTimeMs / 1000).toFixed(1)}s` : "—"}
        </p>
      </MetaCard>
    </div>
  );
}
