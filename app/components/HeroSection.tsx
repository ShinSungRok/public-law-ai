import { FeatureBadges } from "./FeatureBadges";
import { RobotMascot } from "./RobotMascot";

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-ivory-50">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[36rem] bg-gradient-to-b from-mist-100 via-ivory-50 to-ivory-50"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 py-16 text-center md:flex-row md:gap-14 md:py-24 md:text-left">
        <div className="animate-fade-in-up flex flex-col items-center gap-5 md:w-3/5 md:items-start">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-900/15 bg-white px-3 py-1 text-xs font-medium tracking-wide text-navy-700 uppercase shadow-sm">
            Korean Statute &amp; Case Law Assistant
          </span>

          <h1 className="max-w-xl font-serif text-4xl leading-[1.1] font-semibold text-balance text-navy-900 sm:text-5xl lg:text-[3.4rem]">
            Ask an AI Law Professor.
          </h1>

          <p className="max-w-lg text-lg text-pretty text-navy-700/80">
            Grounded legal answers from real Korean statutes — every response
            is retrieved from official law.go.kr text and traceable back to
            its source article, not a generic guess from a model&apos;s memory.
          </p>

          <FeatureBadges />

          <a
            href="#ask"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-navy-800 px-6 py-3 text-sm font-semibold text-ivory-50 shadow-lg shadow-navy-900/20 transition-all hover:-translate-y-0.5 hover:bg-navy-700 hover:shadow-xl"
          >
            Ask a Question
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="animate-fade-in-up md:w-2/5" style={{ animationDelay: "150ms" }}>
          <RobotMascot />
        </div>
      </div>
    </section>
  );
}
