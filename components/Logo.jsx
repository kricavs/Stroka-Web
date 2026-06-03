import Image from "next/image";
import { SITE } from "@/lib/site";

// Renders the brand logo from a file (easy to replace — see lib/site.js).
// If logoSrc is empty, falls back to a clean text wordmark so the site
// always shows something sensible.
export function Logo({ className = "", priority = false }) {
  if (SITE.logoSrc) {
    return (
      <Image
        src={SITE.logoSrc}
        alt={SITE.name}
        width={SITE.logoWidth}
        height={SITE.logoHeight}
        priority={priority}
        // Pass a height class (e.g. "h-8 w-auto"); w-auto keeps the ratio.
        className={`object-contain ${className}`}
      />
    );
  }
  return <Wordmark className={className} />;
}

// Text fallback wordmark.
export function Wordmark({ className = "" }) {
  return (
    <span
      className={`inline-flex flex-col leading-none ${className}`}
      aria-label="Stroka Visual"
    >
      <span className="font-display font-semibold tracking-[0.18em] text-bone">
        STROKA
      </span>
      <span className="mt-1 flex items-center gap-2 font-display text-[0.5em] font-light tracking-wider3 text-ash">
        <span className="h-px flex-1 bg-ash/40" />
        VISUAL
        <span className="h-px flex-1 bg-ash/40" />
      </span>
    </span>
  );
}

export default Logo;
