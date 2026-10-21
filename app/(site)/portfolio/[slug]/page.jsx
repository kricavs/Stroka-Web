import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Reveal from "@/components/Reveal";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import PhotoSequence from "@/components/portfolio/PhotoSequence";
import { getProject, getProjects } from "@/lib/portfolio";

// Only the projects defined in content/portfolio/proyectos exist as routes.
export const dynamicParams = false;

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }) {
  const project = getProject(params.slug);
  if (!project) return {};
  const description = project.description[0] || `${project.title} — ${project.category.title}`;
  return {
    title: `${project.title} — Stroka Visual`,
    description,
    alternates: { canonical: `/portfolio/${project.slug}` },
    openGraph: {
      title: project.title,
      description,
      type: "article",
      url: `/portfolio/${project.slug}`,
      images: [{ url: project.hero.src, width: project.hero.width, height: project.hero.height, alt: project.hero.alt }],
    },
  };
}

function Meta({ label, children }) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-wider2 text-ash">{label}</dt>
      <dd className="mt-1.5 font-display text-base text-bone md:text-lg">{children}</dd>
    </div>
  );
}

export default function ProjectPage({ params }) {
  const project = getProject(params.slug);
  if (!project) notFound();

  const { title, client, year, category, description, services, hero, photos, videos, example } = project;
  const all = getProjects();
  const next = all[(all.findIndex((p) => p.slug === project.slug) + 1) % all.length];
  const hasMeta = client || year || services.length > 0;

  return (
    <article>
      {/* Cover */}
      <header className="relative h-[56svh] min-h-[340px] max-h-[600px] w-full overflow-hidden bg-ink md:h-[56vh] md:min-h-[420px] lg:h-[56vh] lg:max-h-[532px]">
        <Image src={hero.src} alt={hero.alt} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-transparent to-ink/80" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-7xl px-6 pb-7 md:px-10 md:pb-10">
            <p className="mb-3 flex items-center gap-3 text-[0.7rem] uppercase tracking-wider3 text-bone/80">
              <span className="h-px w-6 bg-bone/50" />
              {category.title}
              {example ? <span className="text-ash">· Ejemplo</span> : null}
            </p>
            <h1 className="max-w-4xl text-balance break-words font-display text-3xl font-light leading-[1.08] tracking-wide text-bone sm:text-5xl md:text-6xl">
              {title}
            </h1>
          </div>
        </div>
      </header>

      {/* Brief */}
      {hasMeta || description.length > 0 ? (
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-12 md:gap-10 md:px-10 md:py-9">
          {hasMeta ? (
            <Reveal className="md:col-span-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
                {client ? <Meta label="Cliente">{client}</Meta> : null}
                {year ? <Meta label="Año">{year}</Meta> : null}
                {services.length > 0 ? (
                  <Meta label="Servicios">
                    <ul className="space-y-0.5 text-base">
                      {services.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </Meta>
                ) : null}
              </dl>
            </Reveal>
          ) : null}
          {description.length > 0 ? (
            <Reveal delay={100} className={hasMeta ? "md:col-span-6 md:col-start-7" : "md:col-span-8 md:col-start-3"}>
              <div className="space-y-4 text-base leading-relaxed text-ash md:text-lg md:leading-relaxed">
                {description.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </Reveal>
          ) : null}
        </section>
      ) : (
        <div className="h-6 md:h-8" />
      )}

      {/* Video */}
      {videos.length > 0 ? (
        <section aria-label="Videos" className="mx-auto max-w-[1320px] space-y-3 px-6 pb-10 pt-10 sm:space-y-5 sm:pt-12 md:px-10 md:pb-14 md:pt-16">
          {videos.map((v) => (
            <YouTubeEmbed key={v.id} id={v.id} title={v.title} />
          ))}
        </section>
      ) : null}

      {/* Photography */}
      {photos.length > 0 ? (
        <section aria-label="Fotografías" className="mx-auto max-w-7xl px-6 pb-12 md:px-10 md:pb-16">
          <PhotoSequence photos={photos} label={`Fotografías de ${title}`} />
        </section>
      ) : null}

      {/* Navigation */}
      <nav aria-label="Proyectos" className="border-t hairline">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between md:px-10 md:py-6">
          <Link
            href="/portfolio"
            className="text-[0.72rem] uppercase tracking-wider2 text-ash transition-colors hover:text-bone focus-visible:text-bone focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-bone"
          >
            ← Todos los proyectos
          </Link>
          {next && next.slug !== project.slug ? (
            <Link
              href={`/portfolio/${next.slug}`}
              className="group md:text-right focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-bone"
            >
              <span className="block text-[0.65rem] uppercase tracking-wider2 text-ash">Siguiente proyecto</span>
              <span className="mt-1 block font-display text-xl font-light text-bone transition-colors group-hover:text-ash md:text-3xl">
                {next.title} →
              </span>
            </Link>
          ) : null}
        </div>
      </nav>
    </article>
  );
}
