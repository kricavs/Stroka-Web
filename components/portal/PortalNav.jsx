"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["resumen", "Resumen"],
  ["calendario", "Calendario"],
  ["pendientes", "Pendientes"],
  ["archivos", "Archivos"],
];

export default function PortalNav({ base }) {
  const path = usePathname() || "";
  return (
    <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto text-[0.7rem] uppercase tracking-wider2">
      {ITEMS.map(([slug, label]) => {
        const active = path === `${base}/${slug}` || path.startsWith(`${base}/${slug}/`) || (slug === "calendario" && path.startsWith(`${base}/contenido`));
        return (
          <Link
            key={slug}
            href={`${base}/${slug}`}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-3 transition-colors sm:px-4 ${
              active ? "border-[var(--accent)] text-[#f4f4f2]" : "border-transparent text-[#9a9aa3] hover:text-[#f4f4f2]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
