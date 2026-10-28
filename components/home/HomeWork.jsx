import Link from "next/link";
import Reveal from "@/components/Reveal";
import FocalImage from "./FocalImage";

// Selected Work: up to 4 projects. 1 → single large frame, 2+ → staggered two-column.
export default function HomeWork({ items }) {
  if (!items.length) return null;
  const single = items.length === 1;
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-40">
      <Reveal>
        <div className="mb-14 flex items-end justify-between md:mb-20">
          <p className="flex items-center gap-3 text-[0.7rem] uppercase tracking-wider3 text-ash">
            <span className="h-px w-6 bg-ash/50" />
            Selected Work
          </p>
          <Link href="/portfolio" className="border-b border-bone/30 pb-1 text-[0.68rem] uppercase tracking-wider2 text-bone/80 transition-colors hover:border-bone hover:text-bone">
            Ver todo
          </Link>
        </div>
      </Reveal>
      <div className={`grid gap-x-10 gap-y-16 md:gap-x-16 md:gap-y-24 ${single ? "" : "md:grid-cols-2"}`}>
        {items.map((p, i) => (
          <Reveal key={p.slug} delay={(i % 2) * 100} className={!single && i % 2 === 1 ? "md:mt-32" : ""}>
            <Link
              href={`/portfolio/${p.slug}`}
              className={`group block focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-bone ${single ? "md:mx-auto md:w-2/3" : ""}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
                <FocalImage
                  image={p.image}
                  alt={p.title}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="grayscale transition duration-700 ease-cine group-hover:grayscale-0 group-focus-visible:grayscale-0"
                />
              </div>
              <div className="mt-5 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[0.65rem] uppercase tracking-wider2 text-ash">{p.category}</p>
                  <h3 className="mt-2 font-display text-xl font-light tracking-wide text-bone md:text-2xl">{p.title}</h3>
                </div>
                {p.year ? <p className="shrink-0 pt-5 text-xs text-ash">{p.year}</p> : null}
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
