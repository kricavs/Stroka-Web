import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "Servicios — Stroka Visual",
  description:
    "Servicios de Stroka Visual: producción audiovisual, fotografía comercial, contenido, eventos, drone, dirección creativa y diseño web.",
};

const SERVICES = [
  {
    title: "Producción audiovisual",
    text: "Piezas con narrativa, dirección y montaje cinematográfico para comunicar con intención.",
  },
  {
    title: "Fotografía comercial",
    text: "Producto, retrato y marca con dirección de luz y una estética sobria.",
  },
  {
    title: "Contenido para redes",
    text: "Material consistente y de alto nivel para sostener la presencia de la marca.",
  },
  {
    title: "Cobertura de eventos",
    text: "Registro integral de eventos corporativos, culturales e institucionales.",
  },
  {
    title: "Drone",
    text: "Tomas aéreas para territorio, arquitectura y producciones de mayor escala.",
  },
  {
    title: "Dirección creativa visual",
    text: "Concepto, criterio y coherencia visual a lo largo de toda la producción.",
  },
  {
    title: "Diseño web y rebranding",
    text: "Identidad, rediseño de marca y presencia digital con la misma mirada.",
  },
];

export default function ServiciosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Servicios"
        title="Qué hacemos"
        intro="Producción de principio a fin, con criterio visual y foco comercial."
      />

      <section className="mx-auto max-w-7xl px-6 pb-32 md:px-10">
        <div className="border-t hairline">
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={i * 50}>
              <div className="group grid grid-cols-1 gap-4 border-b hairline py-8 md:grid-cols-12 md:gap-8 md:py-10">
                <div className="flex items-baseline gap-4 md:col-span-5">
                  <span className="font-display text-sm text-ash">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-2xl font-light tracking-wide text-bone transition-colors md:text-3xl">
                    {s.title}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-ash md:col-span-6 md:col-start-7 md:text-base">
                  {s.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-16 flex flex-col items-start gap-4">
            <p className="font-display text-2xl font-light text-bone md:text-3xl">
              ¿Buscás algo a medida?
            </p>
            <Link
              href="/contacto"
              className="border-b border-bone/40 pb-1 text-[0.72rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
            >
              Contactar
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
