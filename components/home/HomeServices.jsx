import Link from "next/link";
import Reveal from "@/components/Reveal";
import { SERVICES } from "@/lib/services";

// Typographic list, no cards.
export default function HomeServices() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24 md:px-10 md:pb-40">
      <Reveal>
        <p className="mb-10 flex items-center gap-3 text-[0.7rem] uppercase tracking-wider3 text-ash">
          <span className="h-px w-6 bg-ash/50" />
          Servicios
        </p>
      </Reveal>
      <ul className="border-t hairline">
        {SERVICES.map((s, i) => (
          <li key={s.title} className="grid grid-cols-1 gap-2 border-b hairline py-6 md:grid-cols-12 md:gap-8 md:py-8">
            <div className="flex items-baseline gap-4 md:col-span-6">
              <span className="font-display text-sm text-ash">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-display text-2xl font-light tracking-wide text-bone md:text-3xl">{s.title}</h3>
            </div>
            <p className="pl-8 text-sm leading-relaxed text-ash md:col-span-5 md:col-start-8 md:pl-0">{s.text}</p>
          </li>
        ))}
      </ul>
      <Link
        href="/servicios"
        className="mt-10 inline-block border-b border-bone/30 pb-1 text-[0.68rem] uppercase tracking-wider2 text-bone/80 transition-colors hover:border-bone hover:text-bone"
      >
        Ver servicios
      </Link>
    </section>
  );
}
