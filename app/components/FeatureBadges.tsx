const FEATURES = [
  "Grounded Answers",
  "Citation",
  "Public Data",
  "OpenSearch",
  "PostgreSQL",
  "Claude",
];

export function FeatureBadges() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2">
      {FEATURES.map((feature) => (
        <li
          key={feature}
          className="rounded-full border border-navy-900/10 bg-white/70 px-3 py-1 text-xs font-medium text-navy-700 backdrop-blur"
        >
          {feature}
        </li>
      ))}
    </ul>
  );
}
