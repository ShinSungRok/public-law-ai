import Image from "next/image";

// Dedicated image area for the AI law professor mascot. Points at a
// temporary local placeholder asset — swap MASCOT_SRC for the final
// illustration path once it exists; nothing else here needs to change.
const MASCOT_SRC = "/images/ai-law-professor-mascot.svg";

interface FloatingBadgeProps {
  className: string;
  delayMs: number;
  label: string;
  children: React.ReactNode;
}

function FloatingBadge({ className, delayMs, label, children }: FloatingBadgeProps) {
  return (
    <div
      aria-hidden="true"
      style={{ animationDelay: `${delayMs}ms` }}
      className={`animate-float absolute flex h-11 w-11 items-center justify-center rounded-2xl border border-navy-900/10 bg-white text-gold-600 shadow-lg shadow-navy-900/10 sm:h-12 sm:w-12 ${className}`}
      title={label}
    >
      {children}
    </div>
  );
}

export function RobotMascot({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto w-64 shrink-0 sm:w-72 md:w-80 ${className}`}>
      <div className="relative aspect-square">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-b from-gold-400/20 via-mist-100 to-transparent"
        />
        <Image
          src={MASCOT_SRC}
          alt="Friendly robot AI law professor mascot — round face, big eyes, round glasses, a blue and gold graduation cap and academic gown, holding a law book and a glowing digital pointer"
          fill
          priority
          sizes="(min-width: 768px) 20rem, (min-width: 640px) 18rem, 16rem"
          className="relative object-contain drop-shadow-[0_20px_35px_rgba(15,33,69,0.18)]"
        />

        <FloatingBadge className="top-2 left-0 sm:-left-2" delayMs={0} label="Verified">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </FloatingBadge>

        <FloatingBadge className="top-6 -right-1 sm:top-8 sm:-right-3" delayMs={900} label="Search">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="5" />
            <path d="M16 16l-3.2-3.2" strokeLinecap="round" />
          </svg>
        </FloatingBadge>

        <FloatingBadge className="bottom-8 -left-2 sm:bottom-10 sm:-left-4" delayMs={1600} label="Citation">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M5 4h7l3 3v9a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 5 16Z"
              strokeLinejoin="round"
            />
            <path d="M7.5 9.5h5M7.5 12.5h5" strokeLinecap="round" />
          </svg>
        </FloatingBadge>

        <FloatingBadge className="right-0 bottom-2 sm:-right-2" delayMs={2300} label="Grounded">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 3v14M4 6l-2 5a2.5 2.5 0 0 0 5 0L5 6Zm12 0l-2 5a2.5 2.5 0 0 0 5 0l-2-5ZM4 6h12M6.5 17h7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </FloatingBadge>
      </div>
    </div>
  );
}
