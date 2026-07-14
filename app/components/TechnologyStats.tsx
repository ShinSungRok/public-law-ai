import { Reveal } from "./Reveal";

interface TechStat {
  label: string;
  description: string;
  icon: React.ReactNode;
}

const STATS: TechStat[] = [
  {
    label: "372 Articles Indexed",
    description: "Real Korean statute articles from law.go.kr, parsed at article level.",
    icon: (
      <path d="M5 3.5h7l3 3V16a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 16V4a.5.5 0 0 1 .5-.5Zm2.5 6h5m-5 3h5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    label: "OpenSearch",
    description: "BM25 keyword, vector, and hybrid retrieval with re-ranking.",
    icon: <path d="M8.5 8.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm7.5 7.5-3.2-3.2" strokeLinecap="round" />,
  },
  {
    label: "PostgreSQL",
    description: "Source of truth for ingested statute articles, upsert-safe.",
    icon: (
      <path
        d="M4 5c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2Zm0 0v10c0 1.1 2.7 2 6 2s6-.9 6-2V5M4 10c0 1.1 2.7 2 6 2s6-.9 6-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    label: "Claude",
    description: "Anthropic's Claude generates grounded answers from context.",
    icon: <path d="M10 2.5 12 8l5.5 2-5.5 2-2 5.5-2-5.5L2.5 10 8 8l2-5.5Z" strokeLinejoin="round" />,
  },
  {
    label: "Grounded RAG",
    description: "Every answer traces back to retrieved statute text, not memory.",
    icon: (
      <path
        d="M10 3v14M4 6l-2 5a2.5 2.5 0 0 0 5 0L5 6Zm12 0l-2 5a2.5 2.5 0 0 0 5 0l-2-5ZM4 6h12M6.5 17h7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    label: "Evaluation",
    description: "Retrieval quality benchmarked on hit rate, recall, and MRR.",
    icon: <path d="M4 16V9m6 7V4m6 12v-5M3 16h14" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    label: "Production Ready",
    description: "Typed domain model, composition root, validated pipelines.",
    icon: <path d="M10 2.5 16 5v5c0 4-2.5 6.5-6 7.5-3.5-1-6-3.5-6-7.5V5l6-2.5Zm-2.7 7.3 2 2 3.4-4" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

export function TechnologyStats() {
  return (
    <section id="technology" className="border-t border-navy-900/10 bg-mist-50 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal className="mx-auto max-w-xl text-center">
          <span className="text-xs font-medium tracking-wide text-gold-700 uppercase">
            Under the hood
          </span>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-navy-900 sm:text-3xl">
            Built like a production platform
          </h2>
          <p className="mt-3 text-navy-700/75">
            Not a demo wrapper around a single API call — a full retrieval,
            grounding, and evaluation stack.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal key={stat.label} delayMs={index * 80}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm shadow-navy-900/5 transition-all hover:-translate-y-1 hover:shadow-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    {stat.icon}
                  </svg>
                </span>
                <h3 className="font-serif text-base font-semibold text-navy-900">{stat.label}</h3>
                <p className="text-sm text-navy-700/70">{stat.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
