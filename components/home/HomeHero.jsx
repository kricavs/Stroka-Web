import Link from "next/link";
import FocalImage from "./FocalImage";

// One fixed image chosen in Studio. Almost no text.
export default function HomeHero({ image }) {
  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <FocalImage image={image} sizes="100vw" priority className="grayscale" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-transparent to-ink/75" />
      <h1 className="sr-only">Stroka Visual — Productora audiovisual</h1>
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 pb-10 md:flex-row md:items-end md:justify-between md:px-10 md:pb-12">
          <p className="text-[0.68rem] uppercase tracking-wider3 text-bone/80">Productora audiovisual</p>
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
    </section>
  );
}
