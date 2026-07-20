import { FeatureBadges } from "./FeatureBadges";

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 -z-20 hero-atmosphere" />
      <div
        aria-hidden="true"
        className="animate-drift absolute inset-0 -z-10 hero-waves opacity-70"
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
        <span className="animate-fade-in-up inline-flex items-center gap-1.5 rounded-full border border-navy-900/10 bg-white/70 px-3.5 py-1 text-xs font-medium tracking-wide text-navy-700 uppercase shadow-sm backdrop-blur">
          Retrieval-Augmented Legal Assistant
        </span>

        <h1
          className="animate-fade-in-up max-w-4xl font-sans text-[3.4rem] leading-[0.98] font-extrabold tracking-tight text-balance text-navy-900 sm:text-7xl lg:text-8xl"
          style={{ animationDelay: "60ms" }}
        >
          Public Law AI
        </h1>

        <p
          className="animate-fade-in-up max-w-2xl text-lg text-pretty text-navy-700/75 sm:text-xl"
          style={{ animationDelay: "120ms" }}
        >
          Grounded legal answers, built on official Korean statutes.
          <br className="hidden sm:block" /> Every response is traceable to
          its source.
        </p>

        <div
          className="animate-fade-in-up flex flex-col items-center gap-3 sm:flex-row"
          style={{ animationDelay: "180ms" }}
        >
          <a
            href="#ask"
            className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-navy-900/20 transition-all outline-none hover:-translate-y-0.5 hover:bg-navy-800 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Start Searching
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>

          <a
            href="#technology"
            className="inline-flex items-center gap-2 rounded-full border border-navy-900/15 bg-white/70 px-7 py-3.5 text-sm font-semibold text-navy-800 shadow-sm backdrop-blur transition-all outline-none hover:-translate-y-0.5 hover:border-navy-900/25 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            View Architecture
          </a>
        </div>

        <div
          className="animate-fade-in-up mt-2"
          style={{ animationDelay: "240ms" }}
        >
          <FeatureBadges />
        </div>
      </div>
    </section>
  );
}
