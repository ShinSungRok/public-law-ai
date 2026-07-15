import { FeatureBadges } from "./FeatureBadges";
import { RobotMascot } from "./RobotMascot";

export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-ivory-50">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[42rem] bg-gradient-to-b from-mist-100 via-ivory-50 to-ivory-50"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 py-16 text-center md:flex-row md:gap-14 md:py-24 md:text-left">
        <div className="animate-fade-in-up flex flex-col items-center gap-6 md:w-3/5 md:items-start">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-900/15 bg-white px-3 py-1 text-xs font-medium tracking-wide text-navy-700 uppercase shadow-sm">
            Korean Privacy Law Assistant
          </span>

          <h1 className="max-w-xl font-serif text-4xl leading-[1.1] font-semibold text-balance text-navy-900 sm:text-5xl lg:text-[3.4rem]">
            Ask the AI Lawbot.
          </h1>

          <p className="max-w-lg text-lg text-pretty text-navy-700/80">
            Grounded legal answers from official Korean statutes. Every
            response is retrieved from law.go.kr and traceable to its source
            article, rather than generated only from a model&apos;s memory.
          </p>

          <FeatureBadges />

          <div className="w-full max-w-lg rounded-2xl border border-navy-900/10 bg-white/80 p-4 text-left shadow-sm backdrop-blur">
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path
                    d="M5 4.5h10a2 2 0 0 1 2 2V19H7a2 2 0 0 1-2-2V4.5Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 19a2 2 0 0 1 0-4h10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 8h5M9 11h4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div>
                <p className="text-sm font-semibold text-navy-900">
                  Current Legal Coverage
                </p>

                <p className="mt-1 text-sm leading-relaxed text-navy-700/75">
                  This prototype currently answers questions using the
                  Personal Information Protection Act and related regulations
                  indexed from law.go.kr.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    "개인정보 보호법",
                    "시행령",
                    "시행규칙",
                    "관련 개인정보 규정",
                  ].map((coverage) => (
                    <span
                      key={coverage}
                      className="rounded-full border border-navy-900/10 bg-mist-50 px-2.5 py-1 text-xs font-medium text-navy-700"
                    >
                      {coverage}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-xs text-navy-700/55">
                  Additional Korean statutes can be added through the same
                  ingestion and retrieval pipeline.
                </p>
              </div>
            </div>
          </div>

          <a
            href="#ask"
            className="inline-flex items-center gap-2 rounded-full bg-navy-800 px-6 py-3 text-sm font-semibold text-ivory-50 shadow-lg shadow-navy-900/20 transition-all hover:-translate-y-0.5 hover:bg-navy-700 hover:shadow-xl"
          >
            Ask a Question
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M4 10h12M11 5l5 5-5 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        <div
          className="animate-fade-in-up md:w-2/5"
          style={{ animationDelay: "150ms" }}
        >
          <RobotMascot />
        </div>
      </div>
    </section>
  );
}
