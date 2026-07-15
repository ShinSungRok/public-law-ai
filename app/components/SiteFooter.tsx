const STACK = ["law.go.kr", "OpenSearch", "PostgreSQL", "Claude", "Next.js"];

export function SiteFooter() {
  return (
    <footer className="border-t border-navy-900/10 bg-navy-900 text-ivory-50/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col gap-1.5">
          <span className="font-serif text-base font-semibold text-ivory-50">Public Law AI</span>
          <span className="text-xs text-ivory-50/50">AI Lawbot RAG Project</span>
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium tracking-wide text-ivory-50/60 uppercase">
          {STACK.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="border-t border-ivory-50/10 px-6 py-4 text-center text-[11px] text-ivory-50/40">
        Retrieval-augmented legal Q&amp;A — informational only, not legal advice.
      </div>
    </footer>
  );
}
