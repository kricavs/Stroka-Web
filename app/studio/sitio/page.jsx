import { requireSession } from "@/lib/studio/server/auth";
import { blobEnabled } from "@/lib/studio/server/blob";
import { getHomeSlots, listImages } from "@/lib/studio/server/siteHome";
import { getProjects } from "@/lib/portfolio";
import HomeEditor from "@/components/studio/HomeEditor";

export default async function SitePage() {
  await requireSession();
  const [slots, images] = await Promise.all([getHomeSlots(), listImages()]);
  const projects = getProjects().map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category.title,
    cover: p.cover.src,
  }));
  const strip = (s) => (s ? { imageId: s.imageId, focalX: s.focalX, focalY: s.focalY, zoom: s.zoom } : null);
  return (
    <>
      <p className="text-[0.7rem] font-light uppercase tracking-[0.3em] text-champagne">Sitio</p>
      <h1 className="mt-2 font-title text-6xl uppercase leading-none tracking-wide">Inicio</h1>
      <span className="mt-4 block h-px w-10 bg-champagne" />
      <HomeEditor
        projects={projects}
        initialImages={images}
        uploadEnabled={blobEnabled()}
        initial={{
          hero: strip(slots.hero),
          contact: strip(slots.contact),
          work: slots.work.map((w) => ({ projectSlug: w.projectSlug, ...strip(w) })),
        }}
      />
    </>
  );
}
