"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

// Fullscreen, editorial cover. A slow crossfade between featured projects —
// image as protagonist, almost no text. `slides` come from the projects with
// "featured": true (see app/(site)/page.jsx). If there are none, the static
// frames below keep the home working.
const FALLBACK = ["/hero/01.jpg", "/hero/02.jpg", "/hero/03.jpg", "/hero/04.jpg"].map(
  (src) => ({ image: { src, alt: "" } })
);

export default function Hero({ slides = [] }) {
  const projects = slides.length > 0;
  const items = projects ? slides : FALLBACK;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 6500);
    return () => clearInterval(t);
  }, [items.length]);

  const current = items[i];

  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <div className="absolute inset-0 overflow-hidden">
        {items.map((s, idx) => (
          <Image
            key={s.image.src}
            src={s.image.src}
            alt={idx === i ? s.image.alt : ""}
            fill
            quality={85}
            priority={idx === 0}
            sizes="100vw"
            className={`object-cover grayscale transition-opacity duration-[2000ms] ease-cine ${
              idx === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Quiet grading for legibility of the bottom row */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-transparent to-ink/70" />
      </div>

      {/* Discreet bottom row — no big logo, no slogan */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-10 md:pb-12">
          {projects ? (
            // All slides stacked in one grid cell so the block keeps its size while text crossfades.
            <div className="grid text-center md:text-left" aria-live="off">
              {items.map((s, idx) => (
                <div
                  key={s.slug}
                  aria-hidden={idx !== i}
                  className={`col-start-1 row-start-1 transition-opacity duration-[1200ms] ease-cine ${
                    idx === i ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <p className="text-[0.68rem] uppercase tracking-wider3 text-bone/80">{s.category}</p>
                  <p className="mt-2 max-w-xl font-display text-2xl font-light leading-tight text-bone md:text-4xl">
                    {s.title}
                  </p>
                  {s.year ? <p className="mt-2 text-[0.68rem] tracking-wider2 text-bone/70">{s.year}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.68rem] uppercase tracking-wider3 text-bone/80">
              Productora audiovisual
            </p>
          )}
          <div className="flex items-center gap-6">
            <Link
              href={projects ? `/portfolio/${current.slug}` : "/portfolio"}
              className="border-b border-bone/40 pb-1 text-[0.68rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
            >
              {projects ? "Ver proyecto" : "Ver portfolio"}
            </Link>
            <Link
              href="/contacto"
              className="border-b border-transparent pb-1 text-[0.68rem] uppercase tracking-wider2 text-bone/70 transition-colors hover:border-bone/40 hover:text-bone"
            >
              Contacto
            </Link>
          </div>
        </div>
      </div>

      {/* Slide indicators */}
      {items.length > 1 ? (
        <div className="absolute bottom-[4.5rem] left-1/2 z-10 hidden -translate-x-1/2 gap-2 md:flex">
          {items.map((_, idx) => (
            <span
              key={idx}
              className={`h-px w-6 transition-colors duration-500 ${
                idx === i ? "bg-bone" : "bg-bone/30"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
