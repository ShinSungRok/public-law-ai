import { ProfessorPortrait } from "./ProfessorPortrait";

export function HeroSection() {
  return (
    <section
      id="top"
      className="border-b border-navy-900/10 bg-gradient-to-b from-mist-100 to-mist-50"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-6 py-12 text-center md:flex-row md:gap-12 md:py-16 md:text-left">
        <ProfessorPortrait className="md:order-2" />

        <div className="flex flex-col items-center gap-4 md:order-1 md:items-start">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-900/15 bg-white px-3 py-1 text-xs font-medium tracking-wide text-navy-700 uppercase">
            Korean Statute &amp; Case Law Assistant
          </span>
          <h1 className="max-w-md font-serif text-3xl font-semibold text-balance text-navy-900 sm:text-4xl">
            Ask your questions to an AI law professor.
          </h1>
          <p className="max-w-md text-pretty text-navy-700/80">
            Every answer is grounded in retrieved statute text and traceable
            back to its source article — not a generic guess from a model&apos;s
            memory.
          </p>
          <a
            href="#ask"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-navy-800 px-5 py-2.5 text-sm font-medium text-ivory-50 shadow-sm transition-colors hover:bg-navy-700"
          >
            Ask a question
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
