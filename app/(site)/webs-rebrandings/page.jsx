import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Gallery from "@/components/Gallery";
import { getCategory } from "@/lib/site";
import { getCategoryItems } from "@/lib/portfolio";

export const metadata = {
  title: "Webs y rebrandings — Stroka Visual",
  description:
    "Diseño web, identidad visual y rediseño de marca con la estética de Stroka Visual.",
};

export const revalidate = 3600;

export default async function WebsPage() {
  const cat = getCategory("webs-rebrandings");
  const items = await getCategoryItems(cat);

  return (
    <>
      <PageHeader
        eyebrow="Webs y rebrandings"
        title="Identidad y presencia digital"
        intro="Diseño web, rediseño de marca y sistemas visuales. La misma mirada, ahora en pantalla."
      />

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-10">
        <Gallery categories={[{ ...cat, items }]} showFilters={false} />
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
