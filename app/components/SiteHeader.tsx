const NAV_LINKS = [
  { href: "#ask", label: "Ask" },
  { href: "#technology", label: "Technology" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-ivory-50/90 backdrop-blur supports-[backdrop-filter]:bg-ivory-50/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-gold-400"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path
                d="M12 3v18M5 7l-3 6a3.5 3.5 0 0 0 7 0l-3-6Zm14 0l-3 6a3.5 3.5 0 0 0 7 0l-3-6ZM5 7h14M8 21h8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-base font-semibold tracking-tight text-navy-900">
              Public Law AI
            </span>
            <span className="text-[11px] font-medium tracking-wide text-navy-700/70 uppercase">
              AI Law Professor
            </span>
          </span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy-700 transition-colors hover:text-navy-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#ask"
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-gold-600/40 bg-gold-500/10 px-3.5 py-1.5 text-xs font-medium text-navy-800 transition-colors hover:bg-gold-500/20 md:inline-flex"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold-600" />
          Grounded in retrieved statutes
        </a>
      </div>
    </header>
  );
}
