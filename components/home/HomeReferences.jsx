"use client";

import { useEffect, useState } from "react";

const INTERVAL_MS = 7000;

// One reference at a time, soft fade. Hidden when empty; no controls or
// rotation when there is only one.
export default function HomeReferences({ items }) {
  const [i, setI] = useState(0);
  const many = items.length > 1;

  useEffect(() => {
    if (!many) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Re-armed on every change, so a manual click restarts the 7 s clock.
    const t = setTimeout(() => setI((v) => (v + 1) % items.length), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [i, many, items.length]);

  if (!items.length) return null;
  const go = (d) => setI((v) => (v + d + items.length) % items.length);
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <section className="mx-auto max-w-7xl px-6 pb-28 md:px-10 md:pb-48" aria-label="Referencias">
      <p className="mb-12 flex items-center gap-3 text-[0.7rem] uppercase tracking-wider3 text-ash">
        <span className="h-px w-6 bg-ash/50" />
        Referencias
      </p>
      <div className="grid" aria-live={many ? "off" : undefined}>
        {items.map((r, idx) => (
          <figure
            key={r.id}
            aria-hidden={idx !== i}
            className={`col-start-1 row-start-1 transition-opacity duration-[1200ms] ease-cine ${
              idx === i ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <blockquote className="max-w-4xl whitespace-pre-line font-display text-2xl font-light leading-snug text-bone md:text-4xl md:leading-snug">
              “{r.comment}”
            </blockquote>
            <figcaption className="mt-10">
              <p className="text-sm uppercase tracking-wider2 text-bone">{r.brand}</p>
              <p className="mt-2 text-sm text-ash">{r.person}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      {many && (
        <div className="mt-12 flex items-center gap-5 text-xs tracking-wider2 text-ash">
          <button type="button" onClick={() => go(-1)} aria-label="Referencia anterior" className="px-1 text-base transition-colors hover:text-bone">←</button>
          <span aria-live="polite">{pad(i + 1)} / {pad(items.length)}</span>
          <button type="button" onClick={() => go(1)} aria-label="Referencia siguiente" className="px-1 text-base transition-colors hover:text-bone">→</button>
        </div>
      )}
    </section>
  );
}
