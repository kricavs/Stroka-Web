import PageHeader from "@/components/PageHeader";
import ProjectGrid from "@/components/portfolio/ProjectGrid";
import { getProjects, getUsedCategories } from "@/lib/portfolio";

export const metadata = {
  title: "Portfolio — Stroka Visual",
  description:
    "Proyectos de Stroka Visual: fotografía, video, drone, eventos, marcas, institucional y rebranding.",
};

export default function PortfolioPage() {
  const projects = getProjects();
  const categories = getUsedCategories();

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Trabajos"
        intro="Cada tarjeta es un proyecto completo. Entrá para ver las fotografías y los videos."
      />
      <section className="mx-auto max-w-7xl px-6 pb-32 md:px-10">
        <ProjectGrid projects={projects} categories={categories} showFilters />
      </section>
    </>
  );
}
