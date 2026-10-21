"use client";

import { useState } from "react";
import ProjectCard from "@/components/portfolio/ProjectCard";

// Masonry of project cards with optional category filters.
// Props: projects (serialized), categories [{ slug, title }] used by the filter bar.
export default function ProjectGrid({ projects, categories = [], showFilters = true }) {
  const [active, setActive] = useState("all");
  const visible = active === "all" ? projects : projects.filter((p) => p.category.slug === active);
  const filters = [{ slug: "all", title: "Todos" }, ...categories];

  return (
    <div>
      {showFilters && categories.length > 1 ? (
        <div
          role="group"
          aria-label="Filtrar proyectos por categoría"
          className="mb-10 flex flex-wrap gap-x-7 gap-y-3 border-y hairline py-5"
        >
          {filters.map((f) => {
            const on = active === f.slug;
            return (
              <button
                key={f.slug}
                type="button"
                onClick={() => setActive(f.slug)}
                aria-pressed={on}
                className={`relative pb-1 text-[0.72rem] uppercase tracking-wider2 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-bone ${
                  on ? "text-bone" : "text-ash hover:text-bone"
                }`}
              >
                {f.title}
                {on ? <span className="absolute inset-x-0 bottom-0 h-px bg-electric" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <ul className="columns-1 gap-x-5 sm:columns-2 lg:columns-3 lg:gap-x-6">
        {visible.map((p, i) => (
          <li key={p.slug} className="mb-10 break-inside-avoid md:mb-12">
            <ProjectCard project={p} priority={i < 2} />
          </li>
        ))}
      </ul>

      <p
        role="status"
        className={visible.length === 0 ? "py-16 text-center text-sm uppercase tracking-wider2 text-ash" : "sr-only"}
      >
        {visible.length === 0
          ? "Todavía no hay proyectos en esta categoría"
          : `${visible.length} ${visible.length === 1 ? "proyecto" : "proyectos"}`}
      </p>
    </div>
  );
}
