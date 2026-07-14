const FEATURES = [
  "Grounded Answers",
  "Citation",
  "Public Data",
  "OpenSearch",
  "PostgreSQL",
  "Claude AI",
];

export function FeatureBadges() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
      {FEATURES.map((feature) => (
        <li
          key={feature}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy-900/10 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 shadow-sm shadow-navy-900/5"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-gold-600" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3.5 8.2l2.8 2.8L12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {feature}
        </li>
      ))}
    </ul>
  );
}
