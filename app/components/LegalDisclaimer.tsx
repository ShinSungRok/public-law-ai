export function LegalDisclaimer() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-navy-700/60">
      <svg
        viewBox="0 0 20 20"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="7.25" />
        <path d="M10 9v4.25M10 6.75h.01" strokeLinecap="round" />
      </svg>
      <span>
        Informational only, not legal advice — always verify with a licensed
        attorney or the primary statute text.
      </span>
    </p>
  );
}
