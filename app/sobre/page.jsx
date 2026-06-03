import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "Sobre Stroka — Stroka Visual",
  description:
    "Stroka Visual es una productora audiovisual con criterio visual, narrativa y foco comercial para marcas e instituciones.",
};

export default function SobrePage() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-24 pt-36 md:grid-cols-12 md:gap-16 md:px-10 md:pb-32 md:pt-48">
        <div className="md:col-span-6">
          <Reveal>
            <p className="mb-6 text-[0.7rem] uppercase tracking-wider3 text-ash">
              Sobre Stroka
            </p>
            <h1 className="font-display text-4xl font-light leading-[1.08] tracking-wide text-bone sm:text-5xl md:text-6xl">
              Producción visual con criterio.
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-10 space-y-6 text-base leading-relaxed text-ash md:text-lg">
              <p>
                Stroka Visual es una productora audiovisual orientada a marcas,
                empresas, comercios, eventos e instituciones. Trabajamos la
                imagen como lenguaje: cada pieza tiene intención, narrativa y
                una dirección estética definida.
              </p>
              <p>
                Combinamos fotografía, video, drone y diseño para construir
                comunicación visual coherente. No buscamos el ruido: buscamos
                criterio, contraste y una identidad que se sostenga en el
                tiempo.
              </p>
              <p>
                Del concepto a la entrega, acompañamos a cada marca con una
                mirada cinematográfica y un enfoque comercial claro.
              </p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <Link
              href="/contacto"
              className="mt-12 inline-block border-b border-bone/40 pb-1 text-[0.72rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
            >
              Trabajemos juntos
            </Link>
          </Reveal>
        </div>

        <div className="md:col-span-6">
          <Reveal delay={100}>
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-900">
              <Image
                src="/about.jpg"
                alt="Stroka Visual"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pilares */}
      <section className="border-t hairline">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-px bg-transparent px-6 py-20 sm:grid-cols-3 md:px-10 md:py-28">
          {[
            ["Criterio", "Cada decisión visual responde a una intención."],
            ["Producción", "De la idea a la entrega, con estándar profesional."],
            ["Narrativa", "Contamos marcas, no sólo las mostramos."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="px-0 sm:px-6">
                <h3 className="font-display text-xl tracking-wide text-bone">
                  {t}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ash">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
