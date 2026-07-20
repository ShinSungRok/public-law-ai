"use client";

import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "#ask", label: "Platform" },
  { href: "#technology", label: "Architecture" },
  { href: "#technology", label: "Technology" },
];

const GITHUB_URL = "https://github.com/ShinSungRok/public-law-ai";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled
          ? "border-b border-navy-900/10 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <a href="#top" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-gold-400"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path
                d="M12 3v18M5 7l-3 6a3.5 3.5 0 0 0 7 0l-3-6Zm14 0l-3 6a3.5 3.5 0 0 0 7 0l-3-6ZM5 7h14M8 21h8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-navy-900">
            Public Law AI
          </span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-navy-700/80 transition-colors hover:text-navy-900"
            >
              {link.label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-navy-700/80 transition-colors hover:text-navy-900"
          >
            GitHub
          </a>
        </nav>

        <a
          href="#ask"
          className="hidden shrink-0 items-center gap-1.5 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white outline-none transition-all hover:-translate-y-0.5 hover:bg-navy-800 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:inline-flex"
        >
          Start Searching
        </a>
      </div>
    </header>
  );
}
