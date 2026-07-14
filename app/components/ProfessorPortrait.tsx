import Image from "next/image";

// Dedicated image area for the AI law professor character. Points at a
// temporary local placeholder asset — swap PLACEHOLDER_SRC for the final
// illustration path once it exists; nothing else here needs to change.
const PLACEHOLDER_SRC = "/images/ai-law-professor-placeholder.svg";

export function ProfessorPortrait({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative mx-auto aspect-square w-56 shrink-0 sm:w-64 md:w-72 ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-gradient-to-b from-gold-400/25 via-mist-100 to-transparent"
      />
      <Image
        src={PLACEHOLDER_SRC}
        alt="Illustration of a calm, dignified AI law professor in a doctoral gown and round glasses, holding a law book"
        fill
        priority
        sizes="(min-width: 768px) 18rem, (min-width: 640px) 16rem, 14rem"
        className="relative object-contain drop-shadow-[0_18px_30px_rgba(15,33,69,0.18)]"
      />
    </div>
  );
}
