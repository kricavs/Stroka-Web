import "server-only";
import { getFeaturedProjects, getProjects } from "@/lib/portfolio";
import { MAX_WORK } from "@/lib/home-shared";
import { getHomeSlots } from "@/lib/studio/server/siteHome";
import { getPublishedTestimonials } from "@/lib/studio/server/testimonials";

const FALLBACK_HERO = { src: "/hero/01.jpg", width: 1600, height: 900 };
const NEUTRAL = { focalX: 50, focalY: 50, zoom: 1 };

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[home] ${err.message}`);
    return fallback;
  }
}

// Everything the home needs. Studio-chosen images win; project cover/hero are
// used only as a fallback when nothing was configured (or the DB is unreachable).
export async function getHomeData() {
  const [slots, testimonials] = await Promise.all([
    safe(getHomeSlots, { hero: null, contact: null, work: [] }),
    safe(getPublishedTestimonials, []),
  ]);
  const projects = getProjects();
  const featured = getFeaturedProjects();

  const img = (slot, fallback) =>
    slot?.image
      ? { src: slot.image.url, width: slot.image.width, height: slot.image.height, focalX: slot.focalX, focalY: slot.focalY, zoom: slot.zoom }
      : { ...fallback, ...NEUTRAL };

  const heroFallback = featured[0]?.hero || FALLBACK_HERO;
  const hero = img(slots.hero, heroFallback);
  const contact = img(slots.contact, featured[1]?.hero || heroFallback);

  let work = slots.work
    .map((w) => {
      const p = projects.find((x) => x.slug === w.projectSlug);
      if (!p) return null;
      return { slug: p.slug, title: p.title, category: p.category.title, year: p.year, image: img(w, p.cover) };
    })
    .filter(Boolean);
  if (!work.length) {
    work = featured.slice(0, MAX_WORK).map((p) => ({
      slug: p.slug, title: p.title, category: p.category.title, year: p.year, image: img(null, p.cover),
    }));
  }

  return { hero, contact, work, testimonials };
}
