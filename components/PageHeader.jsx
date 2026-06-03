import Reveal from "@/components/Reveal";

export default function PageHeader({ eyebrow, title, intro }) {
  return (
    <header className="mx-auto max-w-7xl px-6 pb-12 pt-36 md:px-10 md:pb-20 md:pt-48">
      <Reveal>
        {eyebrow ? (
          <p className="mb-6 flex items-center gap-3 text-[0.7rem] uppercase tracking-wider3 text-ash">
            <span className="h-px w-6 bg-ash/50" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-4xl font-light leading-[1.05] tracking-wide text-bone sm:text-6xl md:text-7xl">
          {title}
        </h1>
        {intro ? (
          <p className="mt-8 max-w-xl text-base leading-relaxed text-ash md:text-lg">
            {intro}
          </p>
        ) : null}
      </Reveal>
    </header>
  );
}
