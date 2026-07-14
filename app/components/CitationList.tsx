interface CitationListProps {
  citations: string[];
}

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-navy-900/10 px-5 py-4 sm:px-6">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-navy-700 uppercase">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-gold-600" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path
            d="M5 3.5h7l3 3V16a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 16V4a.5.5 0 0 1 .5-.5Z"
            strokeLinejoin="round"
          />
          <path d="M12 3.5V6.5a.5.5 0 0 0 .5.5H15.5M7 9.5h6M7 12.5h6" strokeLinecap="round" />
        </svg>
        Referenced statutes
      </h3>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {citations.map((citation) => (
          <li
            key={citation}
            className="rounded-md border border-gold-600/30 bg-gold-500/10 px-2.5 py-1 text-xs font-medium text-navy-800"
          >
            {citation}
          </li>
        ))}
      </ul>
    </div>
  );
}
