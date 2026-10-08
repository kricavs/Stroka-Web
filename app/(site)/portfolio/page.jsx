import PageHeader from "@/components/PageHeader";
import Gallery from "@/components/Gallery";
import { getPortfolio } from "@/lib/portfolio";

export const metadata = {
  title: "Portfolio — Stroka Visual",
  description:
    "Portfolio de Stroka Visual: fotografía, video, drone, eventos, marcas, institucional y rebranding.",
};

// Revalidate hourly so new Cloudinary uploads appear without a redeploy.
export const revalidate = 3600;

export default async function PortfolioPage() {
  const categories = await getPortfolio();

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Trabajos"
        intro="Seleccioná una categoría. Tocá cualquier imagen para verla en grande."
      />
      <section className="mx-auto max-w-7xl px-6 pb-32 md:px-10">
        <Gallery categories={categories} showFilters />
      </section>
    </>
  );
}
