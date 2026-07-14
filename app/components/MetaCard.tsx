import type { ReactNode } from "react";

interface MetaCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  comingSoon?: boolean;
}

// Shared shell for the small "answer area" panels (Referenced Articles,
// Retrieved Documents, Answer Confidence, Response Time) so they read as
// one consistent system rather than four one-off cards.
export function MetaCard({ title, icon, children, comingSoon }: MetaCardProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-navy-900/10 bg-white p-4 shadow-sm shadow-navy-900/5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-navy-700 uppercase">
          <span aria-hidden="true" className="text-gold-600">
            {icon}
          </span>
          {title}
        </h3>
        {comingSoon && (
          <span className="shrink-0 rounded-full bg-mist-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-navy-700/60 uppercase">
            Coming soon
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
