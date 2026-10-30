import Link from "next/link";
import FocalImage from "./FocalImage";

// Closing CTA over a Studio-chosen image. Links to /contacto.
export default function HomeContact({ image }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <FocalImage image={image} sizes="100vw" className="grayscale" />
      <div className="absolute inset-0 bg-ink/65" />
      <div className="relative mx-auto flex min-h-[70svh] max-w-7xl flex-col items-start justify-center gap-10 px-6 py-28 md:px-10">
        <p className="max-w-3xl font-display text-4xl font-light leading-[1.05] tracking-wide text-bone sm:text-6xl md:text-7xl">
          Contanos qué tenés en mente.
        </p>
        <Link
          href="/contacto"
          className="border-b border-bone/50 pb-1 text-[0.72rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
        >
          Contacto →
        </Link>
      </div>
    </section>
  );
}
