import Image from "next/image";
import Link from "next/link";

// One card = one complete project. Cover photo, name and type of work.
export default function ProjectCard({ project, priority = false }) {
  const { slug, title, category, year, client, cover, example } = project;
  const meta = [client, year].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/portfolio/${slug}`}
      className="group block focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-bone"
    >
      <div className="relative overflow-hidden bg-neutral-900">
        <Image
          src={cover.src}
          alt={cover.alt}
          width={cover.width}
          height={cover.height}
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="h-auto w-full object-cover grayscale transition duration-700 ease-cine group-hover:scale-[1.02] group-hover:grayscale-0 group-focus-visible:grayscale-0"
        />
        {example ? (
          <span className="absolute left-3 top-3 bg-ink/80 px-2 py-1 text-[0.6rem] uppercase tracking-wider2 text-ash">
            Ejemplo
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-wider2 text-ash">{category.title}</p>
          <h3 className="mt-2 font-display text-xl font-light tracking-wide text-bone md:text-2xl">{title}</h3>
        </div>
        {meta ? <p className="shrink-0 pt-5 text-xs text-ash">{meta}</p> : null}
      </div>
    </Link>
  );
}
