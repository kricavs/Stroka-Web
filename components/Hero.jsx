"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

// Fullscreen, editorial cover. A slow crossfade between a few frames —
// image as protagonist, almost no text. Swap `slides` for your own images
// (or replace the whole block with a <video>).
const slides = [
  "/hero/01.jpg",
  "/hero/02.jpg",
  "/hero/03.jpg",
  "/hero/04.jpg",
];

export default function Hero() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-ink">
      {slides.map((src, idx) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={idx === 0}
          sizes="100vw"
          className={`object-cover grayscale transition-opacity duration-[2000ms] ease-cine ${
            idx === i ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Quiet grading for legibility of the top nav and bottom row */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-transparent to-ink/70" />

      {/* Discreet bottom row — no big logo, no slogan */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-10 md:pb-12">
          <p className="text-[0.68rem] uppercase tracking-wider3 text-bone/80">
            Productora audiovisual
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/portfolio"
              className="border-b border-bone/40 pb-1 text-[0.68rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
            >
              Ver portfolio
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
      <div className="absolute bottom-[4.5rem] left-1/2 z-10 hidden -translate-x-1/2 gap-2 md:flex">
        {slides.map((_, idx) => (
          <span
            key={idx}
            className={`h-px w-6 transition-colors duration-500 ${
              idx === i ? "bg-bone" : "bg-bone/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
