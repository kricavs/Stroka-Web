import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ProjectGrid from "@/components/portfolio/ProjectGrid";
import { getProjectsByCategory } from "@/lib/portfolio";

export const metadata = {
  title: "Webs y rebrandings — Stroka Visual",
  description:
    "Diseño web, identidad visual y rediseño de marca con la estética de Stroka Visual.",
};

export default function WebsPage() {
  const projects = getProjectsByCategory("webs-rebrandings");

  return (
    <>
      <PageHeader
        eyebrow="Webs y rebrandings"
        title="Identidad y presencia digital"
        intro="Diseño web, rediseño de marca y sistemas visuales. La misma mirada, ahora en pantalla."
      />

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-10">
        <ProjectGrid projects={projects} showFilters={false} />
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-32 md:px-10">
        <Link
          href="/contacto"
          className="inline-block border-b border-bone/40 pb-1 text-[0.72rem] uppercase tracking-wider2 text-bone transition-colors hover:border-bone"
        >
          Renová tu marca
        </Link>
      </div>
    </>
  );
}
