const STACK = ["law.go.kr", "OpenSearch", "PostgreSQL", "Claude", "Next.js"];

export function SiteFooter() {
  return (
    <footer className="border-t border-navy-900/10 bg-navy-950 text-white/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold tracking-tight text-white">Public Law AI</span>
          <span className="text-xs text-white/45">Grounded AI, grounded legal Q&amp;A</span>
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium tracking-wide text-white/55 uppercase">
          {STACK.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="border-t border-white/10 px-6 py-4 text-center text-[11px] text-white/35">
        © 2024 Public Law AI. All rights reserved.
      </div>
    </footer>
  );
}
